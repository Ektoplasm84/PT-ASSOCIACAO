const path = require("path");
const fs = require("fs");

// Load .env before any other require so env vars are available to all modules
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
}

// Intercept console before any other module so startup logs are captured
require("./utils/logstream");

const express = require("express");
const session = require("express-session");
const BetterSqliteStore = require("better-sqlite3-session-store")(session);

// Ensure upload directories exist before anything else
["uploads/photos", "uploads/documents", "uploads/thumbs", "uploads/vault/public", "uploads/vault/admin"].forEach((dir) => {
  fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
});

const db = require("./database/db");
const {
  requireAuth,
  requireAdmin,
  requireViewAll,
} = require("./middleware/auth");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const { router: userRouter, contentDispositionFilename: cdFilename } = require("./routes/user");

const app = express();

// Trust the first proxy (nginx/Apache on cPanel terminates TLS and forwards via HTTP).
// Required for req.secure to be true and for the Secure cookie flag to be set correctly.
app.set("trust proxy", 1);

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "frontend", "views"));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Sessions stored in SQLite
app.use(
  session({
    store: new BetterSqliteStore({ client: db }),
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// Flash messages
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// Method override (supports DELETE/PUT from HTML forms via hidden _method field)
app.use((req, res, next) => {
  if (req.body && req.body._method) {
    req.method = req.body._method.toUpperCase();
    delete req.body._method;
  }
  next();
});

// Serve static frontend assets (CSS, JS, images)
app.use(express.static(path.join(__dirname, "frontend", "public")));

// Serve profile photos and document thumbnails — requires active session.
// path.basename() prevents any path-traversal attempt in the filename segment.
app.get("/uploads/photos/:filename", requireAuth, (req, res) => {
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "photos",
    path.basename(req.params.filename),
  );
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found.");
  res.sendFile(filePath);
});
app.get("/uploads/thumbs/:filename", requireAuth, (req, res) => {
  const filePath = path.join(
    process.cwd(),
    "uploads",
    "thumbs",
    path.basename(req.params.filename),
  );
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found.");
  res.sendFile(filePath);
});

// Routes
app.use("/", authRouter);
app.use("/admin", requireAuth, requireViewAll, adminRouter);
app.use("/profile", requireAuth, userRouter);

// Public vault — member-facing view and download
app.get("/vault", requireAuth, (req, res) => {
  const files = db.prepare(`
    SELECT vf.*, COALESCE(m.arc_name_en, m.first_name || ' ' || m.last_name) as uploader_name
    FROM vault_files vf
    LEFT JOIN users u ON u.id = vf.uploaded_by
    LEFT JOIN members m ON m.user_id = vf.uploaded_by
    WHERE vf.section = 'public' ORDER BY vf.uploaded_at DESC
  `).all();
  res.render("user/vault", { title: "Public Documents", files });
});

app.get("/vault/files/:id", requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM vault_files WHERE id = ? AND section = 'public'`).get(req.params.id);
  if (!row) return res.status(404).send("Not found");
  const filePath = path.join(process.cwd(), "uploads", "vault", "public", row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found on disk");
  res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", cdFilename("attachment", row.original_name));
  res.sendFile(filePath);
});

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "Page Not Found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", { title: "Error", message: err.message });
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// Environment conditional for cPanel/Passenger vs local VS Code execution
if (process.env.PORT && isNaN(Number(process.env.PORT))) {
  app.listen(process.env.PORT, () => {
    console.log(`PT Associacao bound successfully to Passenger runtime.`);
  });
} else {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`PT Associacao running locally on port ${PORT}`);
  });
}
