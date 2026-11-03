"use client";

import { useState } from "react";
import { importInventory } from "@/app/inventory/actions";

type InventoryRow = {
  sku: string;
  name: string;
  price: string;
  cost: string;
  stock: string;
  min_stock: string;
};

type ZipEntry = {
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

const maxFileSize = 5 * 1024 * 1024;
const maxRows = 5000;

function parseCsv(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("El CSV tiene una comilla sin cerrar.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagNameNS("*", "parsererror").length) {
    throw new Error("El archivo Excel contiene una hoja XML inválida.");
  }
  return document;
}

function zipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const lowerBound = Math.max(0, view.byteLength - 65_557);
  let endOffset = -1;
  for (let offset = view.byteLength - 22; offset >= lowerBound; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("No se reconoce el archivo XLSX.");

  const count = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (count > 20_000 || directoryOffset + directorySize > view.byteLength) {
    throw new Error("El archivo Excel tiene una estructura demasiado grande o inválida.");
  }

  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("No se pudo leer el índice del archivo Excel.");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.set(name, {
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
    if (offset > directoryOffset + directorySize) {
      throw new Error("El índice del archivo Excel está incompleto.");
    }
  }

  return entries;
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry | undefined) {
  if (!entry || entry.uncompressedSize > maxFileSize * 4) {
    throw new Error("Al archivo Excel le falta una hoja o excede el tamaño permitido.");
  }
  const view = new DataView(buffer);
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error("Una sección del archivo Excel está dañada.");
  }
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = buffer.slice(start, start + entry.compressedSize);

  if (entry.method === 0) return new TextDecoder().decode(compressed);
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador no puede abrir este tipo de XLSX. Guarda la hoja como CSV UTF-8 e inténtalo de nuevo.");
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const result = await new Response(stream).arrayBuffer();
  if (result.byteLength !== entry.uncompressedSize) {
    throw new Error("No se pudo descomprimir una hoja del archivo Excel.");
  }
  return new TextDecoder().decode(result);
}

function resolveWorkbookTarget(target: string) {
  const segments: string[] = [];
  for (const segment of target.replace(/^\/+/, "").split("/")) {
    if (segment === "..") segments.pop();
    else if (segment && segment !== ".") segments.push(segment);
  }
  const path = segments.join("/");
  return path.startsWith("xl/") ? path : `xl/${path}`;
}

async function parseXlsx(buffer: ArrayBuffer) {
  const entries = zipEntries(buffer);
  const workbook = parseXml(await readZipEntry(buffer, entries.get("xl/workbook.xml")));
  const sheet = workbook.getElementsByTagNameNS("*", "sheet").item(0);
  const relationshipId = sheet?.getAttribute("r:id");
  if (!relationshipId) throw new Error("El libro de Excel no contiene una hoja legible.");

  const relationships = parseXml(await readZipEntry(buffer, entries.get("xl/_rels/workbook.xml.rels")));
  const relationship = Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .find((item) => item.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target");
  if (!target) throw new Error("No se encontró la primera hoja del libro.");

  const sheetXml = parseXml(await readZipEntry(buffer, entries.get(resolveWorkbookTarget(target))));
  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry
    ? Array.from(parseXml(await readZipEntry(buffer, sharedEntry)).getElementsByTagNameNS("*", "si"))
      .map((item) => item.textContent || "")
    : [];
  const records = Array.from(sheetXml.getElementsByTagNameNS("*", "row")).map((xmlRow) => {
    const values: string[] = [];
    for (const cell of Array.from(xmlRow.getElementsByTagNameNS("*", "c"))) {
      const reference = cell.getAttribute("r") || "";
      const column = reference.match(/^[A-Z]+/i)?.[0];
      if (!column) continue;
      if (cell.getElementsByTagNameNS("*", "f").length) {
        throw new Error("Convierte las fórmulas del inventario en valores antes de importar.");
      }
      const index = column.toUpperCase().split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      const value = cell.getElementsByTagNameNS("*", "v").item(0)?.textContent || "";
      const type = cell.getAttribute("t");
      values[index] = type === "s" ? sharedStrings[Number(value)] || "" :
        type === "inlineStr" ? cell.getElementsByTagNameNS("*", "is").item(0)?.textContent || "" :
          type === "b" ? (value === "1" ? "TRUE" : "FALSE") : value;
    }
    return values;
  });
  return records.filter((row) => row.some((value) => value?.trim()));
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function numberValue(value: string, label: string, rowNumber: number) {
  let normalized = value.trim().replace(/[$\s]/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = /,\d{3}$/.test(normalized)
      ? normalized.replace(",", "")
      : normalized.replace(",", ".");
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`Fila ${rowNumber}: ${label} debe ser un número igual o mayor que cero.`);
  }
  return number;
}

function toInventoryRows(records: string[][]): InventoryRow[] {
  const headerIndex = records.findIndex((row) => row.some((value) => value?.trim()));
  if (headerIndex < 0) throw new Error("El archivo no contiene encabezados ni productos.");
  const headers = records[headerIndex].map(normalizeHeader);
  const aliases = {
    sku: ["sku", "codigo", "codigobarras", "barcode", "codigoproducto"],
    name: ["name", "nombre", "producto", "nombreproducto"],
    price: ["price", "precio", "precioventa"],
    cost: ["cost", "costo", "costounitario"],
    stock: ["stock", "existencia", "existencias", "cantidad", "stockactual"],
    min_stock: ["minstock", "stockminimo", "existenciaminima", "minimo"],
  };
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      headers.findIndex((header) => names.includes(header)),
    ]),
  ) as Record<keyof typeof aliases, number>;

  for (const field of ["sku", "name", "price", "stock"] as const) {
    if (columns[field] < 0) {
      throw new Error(`Falta la columna requerida: ${field === "sku" ? "SKU/código" : field === "name" ? "nombre" : field === "price" ? "precio" : "existencias"}.`);
    }
  }

  const rows: InventoryRow[] = [];
  for (let index = headerIndex + 1; index < records.length; index += 1) {
    const record = records[index];
    if (!record.some((value) => value?.trim())) continue;
    const cell = (field: keyof typeof aliases) => columns[field] < 0 ? "" : (record[columns[field]] || "").trim();
    const rowNumber = index + 1;
    const sku = cell("sku");
    const name = cell("name");
    if (!sku || !name) throw new Error(`Fila ${rowNumber}: SKU y nombre son obligatorios.`);
    const price = numberValue(cell("price"), "precio", rowNumber);
    const cost = cell("cost") ? numberValue(cell("cost"), "costo", rowNumber) : 0;
    const stock = numberValue(cell("stock"), "existencias", rowNumber);
    const minStock = cell("min_stock") ? numberValue(cell("min_stock"), "stock mínimo", rowNumber) : 3;
    if ([price, cost, stock, minStock].some((value) => value > 10_000_000)) {
      throw new Error(`Fila ${rowNumber}: los importes y existencias no pueden superar 10,000,000.`);
    }
    if (!Number.isInteger(stock) || !Number.isInteger(minStock)) {
      throw new Error(`Fila ${rowNumber}: existencias y stock mínimo deben ser enteros.`);
    }
    rows.push({
      sku,
      name,
      price: price.toFixed(2),
      cost: cost.toFixed(2),
      stock: String(stock),
      min_stock: String(minStock),
    });
    if (rows.length > maxRows) throw new Error(`El archivo supera el límite de ${maxRows} productos.`);
  }
  if (rows.length === 0) throw new Error("El archivo no tiene filas de productos.");
  return rows;
}

async function parseFile(file: File) {
  if (file.size > maxFileSize) throw new Error("El archivo no puede superar 5 MB.");
  const lowerName = file.name.toLowerCase();
  const records = lowerName.endsWith(".csv")
    ? parseCsv((await file.text()).replace(/^\uFEFF/, ""))
    : lowerName.endsWith(".xlsx")
      ? await parseXlsx(await file.arrayBuffer())
      : null;
  if (!records) throw new Error("Selecciona un archivo .xlsx o .csv.");
  return toInventoryRows(records);
}

export function InventoryImporter({ requestId }: { requestId: string }) {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFileChange(file?: File) {
    setRows([]);
    setMessage("");
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (new Blob([JSON.stringify(parsed)]).size > 500_000) {
        throw new Error("Los datos procesados superan 500 KB. Divide el inventario en varios archivos.");
      }
      setRows(parsed);
      setMessage(`${parsed.length} productos listos. La importación reemplazará las existencias por las del archivo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={importInventory}>
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="rows_json" value={JSON.stringify(rows)} />
      <div className="field">
        <label htmlFor="inventory_file">Archivo Excel (.xlsx) o CSV</label>
        <input
          id="inventory_file"
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={loading}
          onChange={(event) => void handleFileChange(event.currentTarget.files?.[0])}
        />
        <p className="form-help">
          Columnas: SKU/código, nombre, precio, existencias; costo y stock mínimo son opcionales.
          El archivo debe tener una hoja con encabezados en la primera fila. En Excel, guarda los SKU/códigos como texto para conservar ceros iniciales y convierte las fórmulas en valores antes de importar.
        </p>
      </div>
      {message ? <p className={rows.length ? "form-notice" : "form-error"} role={rows.length ? "status" : "alert"}>{message}</p> : null}
      {rows.length ? (
        <div className="table-wrap">
          <table className="appointments">
            <thead><tr><th>SKU</th><th>Producto</th><th>Precio</th><th>Existencias</th></tr></thead>
            <tbody>
              {rows.slice(0, 5).map((row) => (
                <tr key={row.sku}><td>{row.sku}</td><td>{row.name}</td><td>{row.price}</td><td>{row.stock}</td></tr>
              ))}
            </tbody>
          </table>
          {rows.length > 5 ? <p className="muted">Vista previa de 5 de {rows.length} productos.</p> : null}
        </div>
      ) : null}
      <button className="button button-primary" type="submit" disabled={loading || rows.length === 0}>
        {loading ? "Leyendo archivo…" : "Importar y actualizar inventario"}
      </button>
    </form>
  );
}
