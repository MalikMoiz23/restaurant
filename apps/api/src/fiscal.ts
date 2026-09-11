/**
 * Certified invoicing adapter.
 *
 * Portuguese law (and the project plan, section 4) requires that any
 * invoice or simplified invoice be issued by software certified by the
 * Autoridade Tributaria. We deliberately do NOT implement RSA signing,
 * the hash chain, ATCUD allocation, SAF-T export or the fiscal QR here.
 * This module is the seam where a certified provider is called.
 *
 * The development driver below produces clearly-marked NON-FISCAL
 * placeholders so nothing in a test environment can ever be mistaken
 * for a real fiscal document. Point FISCAL_PROVIDER at a real provider
 * before the system takes live money.
 */
import { randomUUID } from 'node:crypto';

export type FiscalLine = {
  name: string;
  qty: number;
  unitPriceCents: number;
  vatRate: number;
};

export type FiscalRequest = {
  tableNumber: number;
  /** null means the guest declined to give a NIF: bill to "Consumidor Final". */
  nif: string | null;
  totalCents: number;
  vatCents: number;
  lines: FiscalLine[];
};

export type FiscalDocument = {
  invoiceNo: string;
  atcud: string;
  qrPayload: string;
  /** False for the development driver. Never render as fiscal when false. */
  certified: boolean;
  provider: string;
  issuedAt: string;
};

const provider = process.env.FISCAL_PROVIDER ?? 'development';

export async function issueFiscalDocument(req: FiscalRequest): Promise<FiscalDocument> {
  if (provider === 'development') return developmentDriver(req);

  // A real driver posts the document to the certified provider and
  // returns the series number, ATCUD and QR payload it allocates.
  // Intentionally unimplemented: wiring this to an actual provider is a
  // procurement decision, not something to guess at.
  throw new Error(
    `Fiscal provider "${provider}" is not wired up. ` +
    `Implement its driver in apps/api/src/fiscal.ts before issuing real invoices.`,
  );
}

/**
 * Development driver. Emits a traceable placeholder, prefixed so it is
 * obvious at a glance that this is not a fiscal document.
 */
async function developmentDriver(req: FiscalRequest): Promise<FiscalDocument> {
  const seq = randomUUID().slice(0, 8).toUpperCase();
  return {
    invoiceNo: `NAO-FISCAL/${seq}`,
    atcud: 'SEM-ATCUD',
    qrPayload: [
      'AVISO:DOCUMENTO-NAO-FISCAL',
      `MESA:${req.tableNumber}`,
      `NIF:${req.nif ?? 'CONSUMIDOR-FINAL'}`,
      `TOTAL:${(req.totalCents / 100).toFixed(2)}`,
      `IVA:${(req.vatCents / 100).toFixed(2)}`,
    ].join('*'),
    certified: false,
    provider: 'development',
    issuedAt: new Date().toISOString(),
  };
}
