import fs from "fs";
import minimist from "minimist";
import path from "path";
import sharp from "sharp";

const supportedFormats = ["jpg", "jpeg", "png", "webp"];

const appArgs = minimist(process.argv.slice(2));
let { input, output, size, format, quality } = appArgs;
let [inputFullPath, fileExt, inputParent] = ["", "", ""];
let sizes = new Array<[number, number]>();

const validateArgs = () => {
  // BEGIN: --input validation
  if (!input)
    throw new Error("--input not specified. Please provide an input file.");

  console.log(input);
  inputFullPath = path.resolve(input);

  if (!fs.existsSync(inputFullPath))
    throw new Error(`--input file not found: ${inputFullPath}`);

  fileExt = path.extname(inputFullPath).toLowerCase().substring(1);

  inputParent = path.dirname(inputFullPath);
  // END: --input validation

  // BEGIN: --output validation
  output ||= inputParent;

  if (!fs.lstatSync(output).isDirectory())
    throw new Error(`--output is not a folder: ${output}`);
  // END: --output validation

  // BEGIN: --size validation
  if (!size)
    throw new Error(
      "--size not specified. Plesae provide a comma-separated list of sizes you want."
    );

  (size as string).split(",").forEach((exp) => {
    exp = exp.trim().toLowerCase();
    const expLW = exp.split("x");

    const length = Number(expLW[0]);
    const width = expLW.length > 1 ? Number(expLW[1]) : length;

    sizes.push([length, width]);
  });

  if (sizes.length <= 0) throw new Error("--size must be specified");
  // END: --size validation

  // BEGIN: --format validation
  format ||= fileExt;

  if (!supportedFormats.includes(format))
    throw new Error(
      `--input file not supported: ${format}, expected one of ${supportedFormats.join(
        ", "
      )}`
    );
  // END: --format validation

  // BEGIN: --quality validation
  if (quality !== undefined) quality = Number(quality);
  if (quality < 1 || quality > 100)
    throw new Error("--quality must be between 1 and 100!");

  quality ||= 90;
  // END: --quality validation
};

const resizeImage = () => {
  const fileName = path.basename(inputFullPath, `.${fileExt}`);

  sizes.forEach((size) => {
    sharp(inputFullPath)
      .resize(size[0], size[1])
      .toFormat(format, { quality: quality })
      .toFile(`${output}/${fileName}_${size[0]}x${size[1]}.${format}`);
  });
};

validateArgs();

console.log(`Input File: ${inputFullPath}`);
console.log(`Output Dir: ${output}`);
console.log(`Sizes: ${sizes.join(", ")}`);
console.log(`Format: ${format}`);

resizeImage();
