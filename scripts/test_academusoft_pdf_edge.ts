/**
 * Smoke test for Deno PDF parser (ADR-0002).
 * Run: deno run -A scripts/test_academusoft_pdf_edge.ts
 */
import {
  parseAcademusoftPdf,
  validatePdfHeaderForModule,
} from "../supabase/functions/_shared/academusoft_pdf.ts";

const fixtures = [
  {
    path: "Reporte_Estudiantes-17.pdf",
    count: 38,
    courseCode: "ADM18",
    groupName: "1_CE_G2",
  },
  {
    path: "Reporte_Estudiantes-18.pdf",
    count: 18,
    courseCode: "INN10",
    groupName: "11_INE_G1",
  },
];

for (const fixture of fixtures) {
  const bytes = await Deno.readFile(fixture.path);
  const parsed = await parseAcademusoftPdf(bytes);
  validatePdfHeaderForModule(parsed.header, fixture.courseCode, fixture.groupName);
  if (parsed.rows.length !== fixture.count) {
    throw new Error(`${fixture.path}: expected ${fixture.count}, got ${parsed.rows.length}`);
  }
  console.log(`OK ${fixture.path} → ${parsed.rows.length} estudiantes`);
}

console.log("All Academusoft PDF edge parser checks passed.");
