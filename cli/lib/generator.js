import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
export async function generateProject(projectName, projectPath, config) {
  await fs.ensureDir(projectPath);
  const packageJson = await generatePackageJson(projectName, config);
  await fs.writeJson(path.join(projectPath, "package.json"), packageJson, {
    spaces: 2,
  });

  const envContent = await generateEnvFile(config);
  await fs.writeFile(path.join(projectPath, ".env.example"), envContent);

  const gitignoreContent = await generateGitignore(config);
  await fs.writeFile(path.join(projectPath, ".gitignore"), gitignoreContent);

  const readmeContent = await generateReadme(projectName, config);
  await fs.writeFile(path.join(projectPath, "README.md"), readmeContent);
  

  await fs.ensureDir(path.join(projectPath, "src/config"));
  await fs.ensureDir(path.join(projectPath, "src/middleware"));
  await fs.ensureDir(path.join(projectPath, "src/controllers"));
  await fs.ensureDir(path.join(projectPath, "src/models"));
  await fs.ensureDir(path.join(projectPath, "src/routes"));
  await fs.ensureDir(path.join(projectPath, "src/schemas"));
  

  if (config.models !== "empty") {
    await fs.ensureDir(path.join(projectPath, "src/models"));
    await fs.ensureDir(path.join(projectPath, "src/controllers"));
  }

  const appContent = generateAppJs(config);
  await fs.writeFile(path.join(projectPath, "src/app.js"), appContent);

  const serverContent = generateServerJs();
  await fs.writeFile(path.join(projectPath, "src/server.js"), serverContent);

  const dbContent = generateDatabaseConfig(config);
  await fs.writeFile(
    path.join(projectPath, "src/config/database.js"),
    dbContent
  );
  await fs.ensureDir(path.join(projectPath, "src/config"));

  const errorMiddleware = generateErrorMiddleware();
  await fs.writeFile(
    path.join(projectPath, "src/middleware/errorHandler.js"),
    errorMiddleware
  );

  const indexRoutes = generateIndexRoutes(config);
  await fs.writeFile(
    path.join(projectPath, "src/routes/index.js"),
    indexRoutes
  );

  if (config.auth === "jwt") {
    const authRoutes = generateAuthRoutes(config);
    await fs.writeFile(
      path.join(projectPath, "src/routes/auth.js"),
      authRoutes
    );

    const authMiddleware = generateAuthMiddleware();
    await fs.writeFile(
      path.join(projectPath, "src/middleware/auth.js"),
      authMiddleware
    );

    const authController = generateAuthController(config);
    await fs.writeFile(
      path.join(projectPath, "src/controllers/authController.js"),
      authController
    );
  }

  if (config.models === "user-post") {
    const userModel = generateUserModel(config);
    await fs.writeFile(path.join(projectPath, "src/models/User.js"), userModel);

    const postModel = generatePostModel(config);
    await fs.writeFile(path.join(projectPath, "src/models/Post.js"), postModel);

    const userController = generateUserController(config);
    await fs.writeFile(
      path.join(projectPath, "src/controllers/userController.js"),
      userController
    );

    const postController = generatePostController(config);
    await fs.writeFile(
      path.join(projectPath, "src/controllers/postController.js"),
      postController
    );

    const userRoutes = generateUserRoutes(config);
    await fs.writeFile(
      path.join(projectPath, "src/routes/users.js"),
      userRoutes
    );

    const postRoutes = generatePostRoutes(config);
    await fs.writeFile(
      path.join(projectPath, "src/routes/posts.js"),
      postRoutes
    );
  }

  if (config.validation === "zod") {
    await fs.ensureDir(path.join(projectPath, "src/schemas"));

    if (config.auth === "jwt") {
      const authSchema = generateAuthSchema();
      await fs.writeFile(
        path.join(projectPath, "src/schemas/authSchema.js"),
        authSchema
      );
    }

    if (config.models === "user-post") {
      const userSchema = generateUserSchema();
      await fs.writeFile(
        path.join(projectPath, "src/schemas/userSchema.js"),
        userSchema
      );

      const postSchema = generatePostSchema();
      await fs.writeFile(
        path.join(projectPath, "src/schemas/postSchema.js"),
        postSchema
      );
    }
  }

  if (config.swagger) {
    const swaggerConfig = generateSwaggerConfig(config);
    await fs.writeFile(
      path.join(projectPath, "src/config/swagger.js"),
      swaggerConfig
    );
  }
}

export async function generatePackageJson(projectName, config) {
  async function getLatestVersion(pkg) {
    try {
      const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${pkg}: ${res.status}`);
      }
      const data = await res.json();
      return `^${data.version}`;
    } catch (error) {
      console.warn(`Failed to get latest version for ${pkg}:`, error.message);
      const fallbackVersions = {
        express: "^4.18.2",
        cors: "^2.8.5",
        helmet: "^7.0.0",
        dotenv: "^16.3.1",
        nodemon: "^3.0.1",
        sqlite3: "^5.1.6",
        sequelize: "^6.32.1",
        pg: "^8.11.1",
        "pg-hstore": "^2.3.4",
        mysql2: "^3.6.0",
        "@prisma/client": "^5.1.1",
        prisma: "^5.1.1",
        jsonwebtoken: "^9.0.1",
        bcryptjs: "^2.4.3",
        zod: "^3.21.4",
        "swagger-ui-express": "^5.0.0",
        "swagger-jsdoc": "^6.2.8",
      };
      return fallbackVersions[pkg] || "^1.0.0";
    }
  }

  const packagesToFetch = [];

  packagesToFetch.push("express", "cors", "helmet", "dotenv", "nodemon");

  if (config.database === "sqlite") {
    packagesToFetch.push("sqlite3", "sequelize");
  } else if (config.database === "postgresql") {
    packagesToFetch.push("pg", "pg-hstore", "sequelize");
  } else if (config.database === "mysql") {
    packagesToFetch.push("mysql2", "sequelize");
  }

  if (config.usePrisma) {
    packagesToFetch.push("@prisma/client", "prisma");
  }

  if (config.auth === "jwt") {
    packagesToFetch.push("jsonwebtoken", "bcryptjs");
  }

  if (config.validation === "zod") {
    packagesToFetch.push("zod");
  }

  if (config.swagger) {
    packagesToFetch.push("swagger-ui-express", "swagger-jsdoc");
  }
  const packageVersions = {};

  try {
    const versionPromises = packagesToFetch.map(async (pkg) => {
      const version = await getLatestVersion(pkg);
      return { pkg, version };
    });

    const results = await Promise.all(versionPromises);
    results.forEach(({ pkg, version }) => {
      packageVersions[pkg] = version;
    });
  } catch (error) {
    console.error("Error fetching package versions:", error);
    throw error;
  }

  const dependencies = {};
  const devDependencies = {};

  dependencies["express"] = packageVersions["express"];
  dependencies["cors"] = packageVersions["cors"];
  dependencies["helmet"] = packageVersions["helmet"];
  dependencies["dotenv"] = packageVersions["dotenv"];
  devDependencies["nodemon"] = packageVersions["nodemon"];

  if (config.database === "sqlite") {
    dependencies["sqlite3"] = packageVersions["sqlite3"];
    dependencies["sequelize"] = packageVersions["sequelize"];
  } else if (config.database === "postgresql") {
    dependencies["pg"] = packageVersions["pg"];
    dependencies["pg-hstore"] = packageVersions["pg-hstore"];
    dependencies["sequelize"] = packageVersions["sequelize"];
  } else if (config.database === "mysql") {
    dependencies["mysql2"] = packageVersions["mysql2"];
    dependencies["sequelize"] = packageVersions["sequelize"];
  }

  if (config.usePrisma) {
    dependencies["@prisma/client"] = packageVersions["@prisma/client"];
    devDependencies["prisma"] = packageVersions["prisma"];
  }

  if (config.auth === "jwt") {
    dependencies["jsonwebtoken"] = packageVersions["jsonwebtoken"];
    dependencies["bcryptjs"] = packageVersions["bcryptjs"];
  }

  if (config.validation === "zod") {
    dependencies["zod"] = packageVersions["zod"];
  }

  if (config.swagger) {
    dependencies["swagger-ui-express"] = packageVersions["swagger-ui-express"];
    dependencies["swagger-jsdoc"] = packageVersions["swagger-jsdoc"];
  }

  const packageJson = {
    name: projectName,
    version: "1.0.0",
    description: "Express.js API dibuat dengan sanScript",
    main: "src/server.js",
    scripts: {
      start: "node src/server.js",
      dev: "nodemon src/server.js",
      test: 'echo "Error: no test specified" && exit 1',
    },
    keywords: ["express", "api", "nodejs"],
    author: "",
    license: "MIT",
    dependencies,
    devDependencies,
  };

  if (config.usePrisma) {
    packageJson.scripts.prisma = "prisma";
    packageJson.scripts.migrate = "prisma migrate dev";
  }

  return packageJson;
}
export async function generateEnvFile(config) {
  let content = `# Environment
NODE_ENV=development
PORT=3000

# Database
`;

  if (config.database === "sqlite") {
    content += `DATABASE_URL=./database.sqlite\n`;
  } else if (config.database === "postgresql") {
    content += `DATABASE_URL=postgresql://username:password@localhost:5432/database_name\n`;
  } else if (config.database === "mysql") {
    content += `DATABASE_URL=mysql://username:password@localhost:3306/database_name\n`;
  }

  if (config.auth === "jwt") {
    content += `
# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
`;
  }

  return content;
}

export async function generateGitignore(config) {
let content = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
*.sqlite
*.db

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;

if (config.usePrisma) {
  content += `
# Prisma
prisma/dev.db
prisma/migrations/
`;
}

return content;
}

export async function generateReadme(projectName, config) {
  let content = `# ${projectName}

Express.js API dibuat dengan sanScript.

## Fitur

- 🚀 Express.js
- 🛡️ Helmet & CORS
- 📦 ${config.database.toUpperCase()} Database
`;

  if (config.auth === "jwt") content += `- 🔐 JWT Authentication\n`;
  if (config.swagger) content += `- 📚 Swagger API Documentation\n`;
  if (config.validation === "zod") content += `- ✅ Zod Validation\n`;
  if (config.models === "user-post") content += `- 👥 User & Post Models\n`;
  if (config.usePrisma) content += `- 🔧 Prisma ORM\n`;
  else content += `- ⚙️ Sequelize ORM\n`;

  content += `
## Instalasi

\`\`\`bash
npm install
\`\`\`

## Konfigurasi

1. Copy file \`.env.example\` ke \`.env\`
2. Sesuaikan konfigurasi \`DATABASE_URL\` sesuai database yang dipilih

## Menjalankan Aplikasi

### Development
\`\`\`bash
npm run dev
\`\`\`

### Production
\`\`\`bash
npm start
\`\`\`

## API Endpoints

### Health Check
- GET \`/health\` - Cek status aplikasi
`;

  if (config.auth === "jwt") {
    content += `
### Authentication
- POST \`/api/auth/register\` - Daftar user baru
- POST \`/api/auth/login\` - Login user
`;
  }

  if (config.models === "user-post") {
    content += `
### Users
- GET \`/api/users\` - Get all users
- GET \`/api/users/:id\` - Get user by ID
- POST \`/api/users\` - Create user
- PUT \`/api/users/:id\` - Update user
- DELETE \`/api/users/:id\` - Delete user

### Posts
- GET \`/api/posts\` - Get all posts
- GET \`/api/posts/:id\` - Get post by ID
- POST \`/api/posts\` - Create post
- PUT \`/api/posts/:id\` - Update post
- DELETE \`/api/posts/:id\` - Delete post
`;
  }

  if (config.swagger) {
    content += `
## API Documentation

Swagger UI tersedia di: \`http://localhost:3000/api-docs\`
`;
  }

  // Struktur Folder
  if (config.usePrisma) {
    content += `
## Struktur Folder

\`\`\`
src/
├── config/          # Konfigurasi aplikasi
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── routes/          # Route definitions
├── schemas/         # Validation schemas
├── utils/           # Utility functions
├── app.js           # Express app setup
└── server.js        # Server entry point
prisma/
└── schema.prisma    # Prisma schema definition
\`\`\`
`;
  } else {
    content += `
## Struktur Folder

\`\`\`
src/
├── config/          # Konfigurasi aplikasi
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/          # Sequelize models
├── routes/          # Route definitions
├── schemas/         # Validation schemas
├── utils/           # Utility functions
├── app.js           # Express app setup
└── server.js        # Server entry point
\`\`\`
`;
  }

  content += `
## Teknologi

- Node.js
- Express.js
- ${
    config.database === "sqlite"
      ? "SQLite"
      : config.database === "postgresql"
      ? "PostgreSQL"
      : "MySQL"
  }
- ${config.usePrisma ? "Prisma ORM" : "Sequelize ORM"}
${config.auth === "jwt" ? "- JWT Authentication\n" : ""}${
    config.validation === "zod" ? "- Zod Validation\n" : ""
  }${config.swagger ? "- Swagger UI\n" : ""}

## License

MIT
`;

  return content;
}

export async function setupPrisma(projectPath, config) {
  await fs.ensureDir(path.join(projectPath, "prisma"));

  const provider =
    config.database === "postgresql"
      ? "postgresql"
      : "mysql";

  const url =
    provider === "postgresql"
      ? "postgresql://USER:PASSWORD@localhost:5432/DB_NAME"
      : "mysql://USER:PASSWORD@localhost:3306/DB_NAME";

  let schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`;

  if (config.models === "user-post") {
    schema += `

model User {
  id    Int    @id @default(autoincrement())
  name  String
  email String @unique
  posts Post[]
}

model Post {
  id      Int    @id @default(autoincrement())
  title   String
  content String
  userId  Int
  user    User   @relation(fields: [userId], references: [id])
}
`;
  }

  await fs.writeFile(path.join(projectPath, "prisma/schema.prisma"), schema);

  const envExamplePath = path.join(projectPath, ".env.example");
  const envData = await fs.readFile(envExamplePath, "utf-8");
  const updatedEnv = envData.replace(
    /DATABASE_URL=.*/g,
    `DATABASE_URL="${url}"`
  );
  await fs.writeFile(envExamplePath, updatedEnv);

  await execa("npx", ["prisma", "generate"], { cwd: projectPath });
}
// Generate various file contents
function generateAppJs(config) {
  let content = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const indexRoutes = require('./routes/index');
`;

  if (config.auth === "jwt") {
    content += `const authRoutes = require('./routes/auth');\n`;
  }

  if (config.models === "user-post") {
    content += `const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
`;
  }

  if (config.swagger) {
    content += `const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
`;
  }

  content += `
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', indexRoutes);
`;

  if (config.auth === "jwt") {
    content += `app.use('/api/auth', authRoutes);\n`;
  }

  if (config.models === "user-post") {
    content += `app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
`;
  }

  if (config.swagger) {
    content += `
// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
`;
  }

  content += `
// Error Handler
app.use(errorHandler);

module.exports = app;
`;

  return content;
}

function generateServerJs() {
  return `const app = require('./app');
const { sequelize } = require('./config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Sync database
    await sequelize.sync();
    console.log('✅ Database synchronized');
    
    app.listen(PORT, () => {
      console.log(\`🚀 Server running on port \${PORT}\`);
      console.log(\`📊 Environment: \${process.env.NODE_ENV || 'development'}\`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
`;
}

function generateDatabaseConfig(config) {
  let content = `const { Sequelize } = require('sequelize');

let sequelize;

`;

  if (config.database === "sqlite") {
    content += `sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_URL || './database.sqlite',
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});`;
  } else if (config.database === "postgresql") {
    content += `sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});`;
  } else if (config.database === "mysql") {
    content += `sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});`;
  }

  content += `

module.exports = { sequelize };
`;

  return content;
}

function generateErrorMiddleware() {
  return `const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      message: 'Data already exists'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Zod validation error
  if (err.name === 'ZodError') {
    const errors = err.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
};

module.exports = errorHandler;
`;
}

function generateIndexRoutes(config) {
  return `const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Welcome message
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to sanScript API',
    version: '1.0.0'
  });
});

module.exports = router;
`;
}

function generateAuthRoutes(config) {
  return `const express = require('express');
const { register, login } = require('../controllers/authController');
const router = express.Router();

// Register
router.post('/register', register);

// Login
router.post('/login', login);

module.exports = router;
`;
}

function generateAuthMiddleware() {
  return `const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = auth;
`;
}

function generateAuthController(config) {
  return `const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
${
  config.validation === "zod"
    ? "const { registerSchema, loginSchema } = require('../schemas/authSchema');"
    : ""
}

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

const register = async (req, res, next) => {
  try {
    ${
      config.validation === "zod"
        ? "const validatedData = registerSchema.parse(req.body);"
        : "const validatedData = req.body;"
    }
    
    const { email, password, name } = validatedData;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      name
    });

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    ${
      config.validation === "zod"
        ? "const validatedData = loginSchema.parse(req.body);"
        : "const validatedData = req.body;"
    }
    
    const { email, password } = validatedData;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};
`;
}

function generateUserModel(config) {
  return `const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  ${
    config.auth === "jwt"
      ? `password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },`
      : ""
  }
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: true
});

// Associations
User.associate = (models) => {
  User.hasMany(models.Post, {
    foreignKey: 'userId',
    as: 'posts'
  });
};

module.exports = { User };
`;
}

function generatePostModel(config) {
  return `const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'posts',
  timestamps: true
});

// Associations
Post.associate = (models) => {
  Post.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'author'
  });
};

module.exports = { Post };
`;
}

function generateUserController(config) {
  return `const { User, Post } = require('../models/User');
${
  config.validation === "zod"
    ? "const { createUserSchema, updateUserSchema } = require('../schemas/userSchema');"
    : ""
}

const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'createdAt'],
      include: [{
        model: Post,
        as: 'posts',
        attributes: ['id', 'title', 'published']
      }]
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'createdAt'],
      include: [{
        model: Post,
        as: 'posts',
        attributes: ['id', 'title', 'content', 'published', 'createdAt']
      }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    ${
      config.validation === "zod"
        ? "const validatedData = createUserSchema.parse(req.body);"
        : "const validatedData = req.body;"
    }
    
    const user = await User.create(validatedData);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    ${
      config.validation === "zod"
        ? "const validatedData = updateUserSchema.parse(req.body);"
        : "const validatedData = req.body;"
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update(validatedData);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.destroy();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
`;
}

function generatePostController(config) {
  return `const { Post, User } = require('../models/User');
${
  config.validation === "zod"
    ? "const { createPostSchema, updatePostSchema } = require('../schemas/postSchema');"
    : ""
}

const getAllPosts = async (req, res, next) => {
  try {
    const posts = await Post.findAll({
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: posts
    });
  } catch (error) {
    next(error);
  }
};

const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const post = await Post.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    ${
      config.validation === "zod"
        ? "const validatedData = createPostSchema.parse(req.body);"
        : "const validatedData = req.body;"
    }
    
    const post = await Post.create(validatedData);
    
    const postWithAuthor = await Post.findByPk(post.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: postWithAuthor
    });
  } catch (error) {
    next(error);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    ${
      config.validation === "zod"
        ? "const validatedData = updatePostSchema.parse(req.body);"
        : "const validatedData = req.body;"
    }

    const post = await Post.findByPk(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.update(validatedData);
    
    const updatedPost = await Post.findByPk(id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'email']
      }]
    });

    res.json({
      success: true,
      message: 'Post updated successfully',
      data: updatedPost
    });
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    await post.destroy();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost
};
`;
}

function generateUserRoutes(config) {
  return `const express = require('express');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');
${config.auth === "jwt" ? "const auth = require('../middleware/auth');" : ""}

const router = express.Router();

// Get all users
router.get('/', getAllUsers);

// Get user by ID
router.get('/:id', getUserById);

// Create user
router.post('/', ${config.auth === "jwt" ? "auth, " : ""}createUser);

// Update user
router.put('/:id', ${config.auth === "jwt" ? "auth, " : ""}updateUser);

// Delete user
router.delete('/:id', ${config.auth === "jwt" ? "auth, " : ""}deleteUser);

module.exports = router;
`;
}

function generatePostRoutes(config) {
  return `const express = require('express');
const {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost
} = require('../controllers/postController');
${config.auth === "jwt" ? "const auth = require('../middleware/auth');" : ""}

const router = express.Router();

// Get all posts
router.get('/', getAllPosts);

// Get post by ID
router.get('/:id', getPostById);

// Create post
router.post('/', ${config.auth === "jwt" ? "auth, " : ""}createPost);

// Update post
router.put('/:id', ${config.auth === "jwt" ? "auth, " : ""}updatePost);

// Delete post
router.delete('/:id', ${config.auth === "jwt" ? "auth, " : ""}deletePost);

module.exports = router;
`;
}

function generateAuthSchema() {
  return `const { z } = require('zod');

const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string()
    .email('Invalid email format'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(255, 'Password must be less than 255 characters')
});

const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format'),
  password: z.string()
    .min(1, 'Password is required')
});

module.exports = {
  registerSchema,
  loginSchema
};
`;
}

function generateUserSchema() {
  return `const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string()
    .email('Invalid email format')
});

const updateUserSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  email: z.string()
    .email('Invalid email format')
    .optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

module.exports = {
  createUserSchema,
  updateUserSchema
};
`;
}

function generatePostSchema() {
  return `const { z } = require('zod');

const createPostSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  content: z.string()
    .min(1, 'Content is required'),
  userId: z.number()
    .int('User ID must be an integer')
    .positive('User ID must be positive'),
  published: z.boolean()
    .optional()
    .default(false)
});

const updatePostSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .optional(),
  content: z.string()
    .min(1, 'Content is required')
    .optional(),
  published: z.boolean()
    .optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided'
});

module.exports = {
  createPostSchema,
  updatePostSchema
};
`;
}

function generateSwaggerConfig(config) {
  return `const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'sanScript API',
      version: '1.0.0',
      description: 'Express.js API dengan auto-generated documentation',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    ${
      config.auth === "jwt"
        ? `components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],`
        : ""
    }
  },
  apis: ['./src/routes/*.js'], // Path ke file routes untuk dokumentasi
};

const specs = swaggerJsdoc(options);

module.exports = specs;
`;
}
