// extractSheet.js — extrai conteúdo de ficheiros XLSX com ExcelJS
import ExcelJS from 'exceljs';

/**
 * Extrai conteúdo de ficheiro XLSX como texto legível.
 * Cada folha é separada por linha vazia com cabeçalho.
 * @param {File} file — ficheiro XLSX
 * @returns {Promise<string>} texto tabulado de todas as folhas
 */
export async function extrairSheet(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const partes = [];
  workbook.eachSheet((worksheet) => {
    let sheetCsv = [];
    worksheet.eachRow((row) => {
      sheetCsv.push(Array.isArray(row.values) ? row.values.slice(1).join(',') : Object.values(row.values).join(','));
    });
    partes.push(`[Folha: ${worksheet.name}]\n${sheetCsv.join('\n')}`);
  });

  return partes.join('\n\n').trim();
}
