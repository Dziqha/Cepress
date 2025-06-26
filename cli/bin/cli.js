#!/usr/bin/env node
import inquirer from "inquirer";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import {
  generateProject,
  setupPrisma,
} from "../lib/generator.js";

import { printBanner } from "../utils/banner.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");
  

const program = new Command();
program
  .name("create-cepress")
  .usage("[project-name]")
  .version(version, "-v, --version", "Tampilkan versi CLI")
  .helpOption("-h, --help", "Tampilkan bantuan")
  .description("Buat project Node.js dengan Express bersama Cepress Generator")
  .argument("[project-name]", "Nama project")
  .action(async (projectName) => {
    printBanner();
    console.log(chalk.blue.bold("🚀 Selamat datang di Cepress Generator!"));
    console.log(
      chalk.gray("Buat project Node.js dengan Express dalam hitungan detik\n")
    );

    if (!projectName) {
      const namePrompt = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "Nama project:",
          default: "my-cepress-app",
          validate: (input) => {
            if (input.trim().length === 0) {
              return "Nama project tidak boleh kosong";
            }
            if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
              return "Nama project hanya boleh mengandung huruf, angka, dash, dan underscore";
            }
            return true;
          },
        },
      ]);
      projectName = namePrompt.projectName;
    }

    const projectPath = path.join(process.cwd(), projectName);
    if (await fs.pathExists(projectPath)) {
      console.log(chalk.red(`❌ Folder "${projectName}" sudah ada!`));
      process.exit(1);
    }

    let config = await inquirer.prompt([
      {
        type: "list",
        name: "database",
        message: "Pilih database:",
        choices: [
          { name: "SQLite (default — cepat & tanpa setup)", value: "sqlite" },
          { name: "PostgreSQL", value: "postgresql" },
          { name: "MySQL", value: "mysql" },
        ],
        default: "sqlite",
      },
    ]);

    if (config.database === "mysql" || config.database === "postgresql") {
      const { usePrisma } = await inquirer.prompt([
        {
          type: "confirm",
          name: "usePrisma",
          message: "Gunakan Prisma sebagai ORM?",
          default: true,
        },
      ]);
      config.usePrisma = usePrisma;
    } else {
      config.usePrisma = false;
    }

    const nextConfig = await inquirer.prompt([
      {
        type: "list",
        name: "auth",
        message: "Pilih autentikasi:",
        choices: [
          { name: "Tanpa Auth", value: "none" },
          {
            name: "JWT Auth (Register/Login dengan hash password)",
            value: "jwt",
          },
        ],
        default: "none",
      },
      {
        type: "list",
        name: "swagger",
        message: "Pilih API documentation:",
        choices: [
          { name: "Tidak pakai Swagger", value: false },
          {
            name: "Swagger (OpenAPI 3.0 docs via swagger-ui-express)",
            value: true,
          },
        ],
        default: false,
      },
      {
        type: "list",
        name: "validation",
        message: "Pilih validasi:",
        choices: [{ name: "Zod (default)", value: "zod" }],
        default: "zod",
      },
      {
        type: "list",
        name: "models",
        message: "Pilih contoh model:",
        choices: [
          { name: "User + Post (berelasi)", value: "user-post" },
          { name: "Kosong (tanpa model)", value: "empty" },
        ],
        default: "user-post",
      },
    ]);

    config = { ...config, ...nextConfig };

    const spinner = ora("Membuat project...").start();

    try {
      await generateProject(projectName, projectPath, config);
      if (config.usePrisma) {
        await setupPrisma(projectPath, config);
      }
      spinner.succeed(chalk.green("✅ Project berhasil dibuat!"));

      console.log(
        chalk.green.bold("\n🎉 Selamat! Project sanScript telah dibuat.")
      );
      console.log(chalk.gray("Langkah selanjutnya:"));
      console.log(chalk.cyan(`  cd ${projectName}`));
      console.log(chalk.cyan("  npm install"));
      console.log(chalk.cyan("  npm run dev"));

      console.log(chalk.yellow(`\n⚠️  Jangan lupa:`));
      console.log(chalk.yellow(`  1. Salin file .env.example menjadi .env`));
      console.log(
        chalk.yellow(
          `  2. Sesuaikan nilai DATABASE_URL sesuai database yang kamu pakai`
        )
      );

      if (config.usePrisma) {
        console.log(chalk.cyan("\n💡 Prisma sudah diinisialisasi untukmu."));
        console.log(chalk.cyan("  Kamu bisa langsung jalankan:"));
        console.log(chalk.cyan("  npx prisma migrate dev --name init"));
      }

      console.log(chalk.gray("\nSelamat coding! 🚀"));
    } catch (error) {
      spinner.fail(chalk.red("❌ Gagal membuat project"));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();