import path from "path";
import fs from "fs";
import multer from "multer";

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const dir = path.join(process.cwd(), "pricedb");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, _file, cb) {
    const type = (req.query.type as string) || "Accubid";
    let filename = "AccubidDevices_DataBase.xlsx";
    if (type === "Conest") filename = "Conest_DataBase.xlsx";
    if (type === "McCormic") filename = "McCormic_DataBase.xlsx";
    cb(null, filename);
  },
});

export const upload = multer({ storage });
