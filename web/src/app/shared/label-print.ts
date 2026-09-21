import JsBarcode from 'jsbarcode';
import { Product } from '../core/models';

/** Render a Code128 barcode of the SKU as a static inline SVG string (no runtime JS in the print window). */
function barcodeSvg(sku: string): string {
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(el, sku, { format: 'CODE128', displayValue: false, margin: 0, height: 34, width: 1.4 });
    return new XMLSerializer().serializeToString(el);
  } catch {
    return '';   // never let a bad SKU break the whole sheet
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
const usd = (v: number) => '$' + v.toFixed(2);
const CAP = 2000;   // guard against an accidental thousand-page print job

/**
 * Opens a print-ready sheet of price/SKU labels. Prices are USD only; each label
 * carries a Code128 barcode of the SKU for the phone app to scan.
 * byStock=false → one label per product; byStock=true → one label per unit in stock
 * (per size when a product has variants), so every physical item can be tagged.
 * Returns the number of labels produced (0 when there was nothing to print).
 */
export function printProductLabels(products: Product[], byStock: boolean): number {
  const slots: { name: string; sku: string; size: string | null; price: number; qty: number }[] = [];
  for (const p of products) {
    if (p.variants?.length) {
      for (const v of p.variants) {
        slots.push({ name: p.name, sku: p.sku, size: v.size, price: v.salePrice ?? p.salePrice,
          qty: byStock ? v.quantityOnHand : 1 });
      }
    } else {
      slots.push({ name: p.name, sku: p.sku, size: p.size ?? null, price: p.salePrice,
        qty: byStock ? p.quantityOnHand : 1 });
    }
  }

  const requested = slots.reduce((n, s) => n + Math.max(0, s.qty), 0);
  let count = 0;
  const parts: string[] = [];
  for (const s of slots) {
    for (let i = 0; i < s.qty && count < CAP; i++, count++) {
      parts.push(`
      <div class="label">
        <div class="brand">Vihitha</div>
        <div class="name">${esc(s.name)}</div>
        ${s.size ? `<div class="size">Size: ${esc(s.size)}</div>` : ''}
        <div class="price">${usd(s.price)}</div>
        <div class="bc">${barcodeSvg(s.sku)}</div>
        <div class="sku">${esc(s.sku)}</div>
      </div>`);
    }
  }

  if (count === 0) return 0;
  const capNote = requested > CAP
    ? `<div class="note">Showing the first ${CAP} of ${requested} labels — narrow the selection to print the rest.</div>` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
      @page { margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: Roboto, Arial, sans-serif; margin: 0; }
      .note { font-size: 9pt; color: #6e1f3e; margin: 0 0 4mm; }
      .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
      .label { border: 1px solid #d9c7cf; border-radius: 3mm; padding: 3.5mm; text-align: center;
        break-inside: avoid; page-break-inside: avoid; height: 38mm; display: flex; flex-direction: column;
        justify-content: center; gap: 1mm; }
      .brand { font-family: Georgia, 'Times New Roman', serif; color: #6e1f3e; font-size: 10pt; letter-spacing: .5px; }
      .name { font-size: 9pt; color: #3a2530; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .size { font-size: 8pt; color: #6b5560; }
      .price { font-size: 13pt; font-weight: 700; color: #6e1f3e; }
      .bc { margin-top: 1mm; }
      .bc svg { width: 100%; height: 9mm; }
      .sku { font-family: 'Courier New', monospace; font-size: 8pt; font-weight: 700; letter-spacing: 1px; }
    </style></head><body onload="window.print()">${capNote}<div class="sheet">${parts.join('')}</div></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  return count;
}
