import path from "path";
import fs from "fs";

/**
 * 
 * @description 替换
 * @param obj 
 * @param keyMap 
 */
export function recursiveReplaceObjectKeys(obj, keyMap) {
  Object.keys(obj).forEach(key => {
    if (keyMap[key]) {
      obj[keyMap[key]] = obj[key];
      if (typeof obj[key] === "object") {
        recursiveReplaceObjectKeys(obj[keyMap[key]], keyMap);
      }
      delete obj[key];
    } else if (keyMap[key] === false) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      recursiveReplaceObjectKeys(obj[key], keyMap);
    }
  });
}

/**
 * @description 组装页面路径
 */
export function formatPagesName(ctx) {
  const { outputPath } = ctx.paths;
  const { PLATFORM_ENV } = process.env;
  const { fs: { readJson, renameSync } } = ctx.helper;
  const fileType = fileTypeMap[PLATFORM_ENV];

  readJson(path.resolve(outputPath, "./app.json")).then(({ pages }) => {
    pages.map(pagePath => {
      Object.keys(fileType).map(key => {
        try {
          const suffix = fileType[key];
          const oldPath = resolvePath(path.join(outputPath, pagePath), suffix);
          const newPath = path.join(outputPath, pagePath + suffix);
          if (oldPath) {
            renameSync(oldPath, newPath)
          }
        } catch (error) {
          console.log(error.message);
        }
      })
    })
  })
}

/**
 * 
 * @description 处理路径
 * @param p 
 * @param suffix 
 * @returns 
 */
export function resolvePath(p: string, suffix: string): string {
  const platformEnv = process.env.PLATFORM_ENV;
  const modeEnv = process.env.MODE_ENV;
  const types = [platformEnv];
  let realpath = "";
  if (modeEnv) {
    types.unshift(`${platformEnv}.${modeEnv}`, modeEnv);
  }
  for (let i = 0, len = types.length; i < len; i++) {
    const type = types[i];
    if (fs.existsSync(realpath = `${p}.${type}${suffix}`)) {
      return realpath;
    }
    if (fs.existsSync(realpath = `${p}${path.sep}index.${type}${suffix}`)) {
      return realpath;
    }
    if (fs.existsSync(realpath = `${p.replace(/\/index$/, `.${type}/index`)}${suffix}`)) {
      return realpath;
    }
  }
  if (fs.existsSync(realpath = `${p}${suffix}`)) {
    return realpath;
  }
  if (fs.existsSync(realpath = `${p}${path.sep}index${suffix}`)) {
    return realpath;
  }
  return ""
}

/**
 * 
 * @description 处理样式表路径
 * @param p 
 * @param helper 
 * @returns 
 */
export function resolveStylePath(p: string, ctx): string {
  const { CSS_EXT } = ctx.helper;
  const removeExtPath = p.replace(path.extname(p), '');
  for (let i = 0, len = CSS_EXT.length; i < len; i++) {
    const item = CSS_EXT[i];
    const path = resolvePath(removeExtPath, item);
    if (path) {
      return path;
    }
  }
  return p
}

/**
 * 
 * @description 处理脚本路径
 * @param name 
 * @param helper 
 * @returns 
 */
export function resolveScriptPath(p: string, ctx): string {
  const { JS_EXT, TS_EXT } = ctx.helper
  const SCRIPT_EXT = JS_EXT.concat(TS_EXT);
  for (let i = 0, len = SCRIPT_EXT.length; i < len; i++) {
    const item = SCRIPT_EXT[i];
    const path = resolvePath(p, item);
    if (path) {
      return path
    }
  }
  return p;
}

/**
 * 文件类型后缀
 */
export const fileTypeMap = {
  weapp: {
    templ: ".wxml",
    style: ".wxss",
    config: ".json",
    script: ".js"
  },
  alipay: {
    templ: ".axml",
    style: ".acss",
    config: ".json",
    script: ".js"
  }
}