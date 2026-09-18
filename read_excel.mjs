import xlsx from 'xlsx';
import fs from 'fs';

const filePath = 'D:\\GestaoSucena\\efetivo_exames.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });

if (data.length > 0) {
  console.log("Headers:", Object.keys(data[0]));
  console.log("First 3 rows:", data.slice(0, 3));
} else {
  console.log("Empty sheet.");
}
