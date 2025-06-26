import chalk from "chalk";
function getTerminalWidth() {
  return process.stdout.columns || 80;
}

function centerText(text) {
  const width = getTerminalWidth();
  return text
    .split("\n")
    .map((line) => {
      const padding = Math.floor((width - line.length) /12);
      return " ".repeat(Math.max(0, padding)) + line;
    })
    .join("\n");
}


function centerLine(line) {
  const width = getTerminalWidth();
  const padding = Math.floor((width - line.length) / 14);
  return " ".repeat(Math.max(0, padding)) + line;
}
function centerLineJudul(line) {
  const width = getTerminalWidth();
  const padding = Math.floor((width - line.length) / 9);
  return " ".repeat(Math.max(0, padding)) + line;
}

export function printBanner() {
  const ascii = `
   ________________
   __  ____/_  ___/
   _  /    _____ \\ 
   / /___  ____/ / 
   \\____/  /____/  
  `.trim();

  const title = "CEPRESS CLI 🚀";
  const subtitle = "Fast Express.js Starter Kit";

  console.log(chalk.cyan(centerText(ascii) + "\n"));
  console.log(chalk.bold.white(centerLineJudul(title)));
  console.log(chalk.gray(centerLine(subtitle) + "\n"));
}
