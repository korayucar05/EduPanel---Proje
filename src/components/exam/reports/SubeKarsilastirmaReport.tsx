import React from "react";

export type SubeKarsilastirmaSatiri = {
  sube: string;
  turkce?: string | number;
  tarih?: string | number;
  cografya?: string | number;
  felsefe?: string | number;
  dinKulturu?: string | number;
  matematik?: string | number;
  fizik?: string | number;
  kimya?: string | number;
  biyoloji?: string | number;
  toplam?: string | number;
  katilim?: string | number;
};

type Props = {
  rows?: SubeKarsilastirmaSatiri[];
  title?: string;
};

const columns = [
  "Şube",
  "Türkçe",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "Din Kültürü ve Ahlak Bilgisi",
  "Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Toplam",
  "Katılım",
];

const createEmptyRows = (): SubeKarsilastirmaSatiri[] =>
  Array.from({ length: 9 }, (_, index) => ({
    sube: `${index + 1}. Şube`,
    turkce: "",
    tarih: "",
    cografya: "",
    felsefe: "",
    dinKulturu: "",
    matematik: "",
    fizik: "",
    kimya: "",
    biyoloji: "",
    toplam: "",
    katilim: "",
  }));

export default function SubeKarsilastirmaReport({
  rows = createEmptyRows(),
  title = "ŞUBE KARŞILAŞTIRMA RAPORU",
}: Props) {
  const visibleRows = rows.slice(0, 9);

  while (visibleRows.length < 9) {
    visibleRows.push({
      sube: "",
      turkce: "",
      tarih: "",
      cografya: "",
      felsefe: "",
      dinKulturu: "",
      matematik: "",
      fizik: "",
      kimya: "",
      biyoloji: "",
      toplam: "",
      katilim: "",
    });
  }

  return (
    <section className="sube-karsilastirma-page">
      <h1>{title}</h1>

      <table className="sube-karsilastirma-table">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>

        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={`${row.sube}-${index}`}>
              <td>{row.sube}</td>
              <td>{row.turkce}</td>
              <td>{row.tarih}</td>
              <td>{row.cografya}</td>
              <td>{row.felsefe}</td>
              <td>{row.dinKulturu}</td>
              <td>{row.matematik}</td>
              <td>{row.fizik}</td>
              <td>{row.kimya}</td>
              <td>{row.biyoloji}</td>
              <td>{row.toplam}</td>
              <td>{row.katilim}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        @page {
          size: A4 landscape;
          margin: 5mm;
        }

        * {
          box-sizing: border-box;
        }

        .sube-karsilastirma-page {
          width: 287mm;
          min-height: 200mm;
          margin: 0 auto;
          padding: 0;
          background: #ffffff;
          color: #0f172a;
          font-family: Arial, Helvetica, sans-serif;
        }

        .sube-karsilastirma-page h1 {
          margin: 0 0 5mm;
          text-align: center;
          font-size: 16pt;
          font-weight: 800;
        }

        .sube-karsilastirma-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          border: 1px solid #334155;
          font-size: 8pt;
        }

        .sube-karsilastirma-table th,
        .sube-karsilastirma-table td {
          height: 17mm;
          padding: 2mm 1mm;
          border: 1px solid #64748b;
          text-align: center;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }

        .sube-karsilastirma-table th {
          height: 18mm;
          background: #e2e8f0;
          color: #0f172a;
          font-weight: 700;
          line-height: 1.15;
        }

        .sube-karsilastirma-table td:first-child {
          font-weight: 700;
          background: #f8fafc;
        }

        @media print {
          html,
          body {
            width: 297mm;
            height: 210mm;
            margin: 0;
            padding: 0;
          }

          .sube-karsilastirma-page {
            width: 287mm;
            margin: 0 auto;
            break-after: page;
          }
        }
      `}</style>
    </section>
  );
}
