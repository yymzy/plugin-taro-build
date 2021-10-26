import path from "path";
import fs from "fs-extra";

export const ref = { current: null }
export const FILE_NAME_REG = /\/((?<filename>(?<name>[^\\\?\/\*\|<>:"]+?)\.)?(?<ext>[^.\\\?\/\*\|<>:"]+))$/;

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
export function formatPagesName() {
  const { ctx } = ref.current;
  const { outputPath } = ctx.paths;
  const { TARO_ENV, PLATFORM_ENV = TARO_ENV } = process.env;
  const { fs: { readJson, renameSync } } = ctx.helper;
  const fileType = fileTypeMap[PLATFORM_ENV];

  if (!fileType) return;
  readJson(path.resolve(outputPath, "./app.json")).then(({ pages, subpackages, subPackages = subpackages }) => {
    const list = [...pages];
    if (subPackages) {
      subPackages.map(({ root, pages = [] }) => {
        list.push(...pages.map(item => `${root}/${item}`))
      });
    }
    list.map(pagePath => {
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
    const pathReg = /\/index$/;
    if (pathReg.test(p) && fs.existsSync(realpath = `${p.replace(pathReg, `.${type}/index`)}${suffix}`)) {
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
export function resolveStylePath(p: string): string {
  const { ctx } = ref.current;
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
export function resolveScriptPath(p: string): string {
  const { ctx } = ref.current;
  const { JS_EXT, TS_EXT } = ctx.helper;
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
  },
  swan: {
    templ: ".swan",
    style: ".css",
    config: ".json",
    script: ".js"
  },
  quick: {
    templ: ".qxml",
    style: ".css",
    config: ".json",
    script: ".js"
  }
}

/**
 * @description 合并数据
 * @param target 
 * @param arg 
 * @returns 
 */
export function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}
export function isArray(arr) {
  return Array.isArray(arr)
}
export function merge(target, ...arg) {
  return arg.reduce((acc, cur) => {
    return Object.keys(cur).reduce((subAcc, key) => {
      const srcVal = cur[key]
      if (isObject(srcVal)) {
        subAcc[key] = merge(subAcc[key] ? subAcc[key] : {}, srcVal)
      } else if (isArray(srcVal)) {
        subAcc[key] = srcVal.map((item, idx) => {
          if (isObject(item)) {
            const curAccVal = subAcc[key] ? subAcc[key] : []
            return merge(curAccVal[idx] ? curAccVal[idx] : {}, item)
          } else {
            return item
          }
        })
      } else {
        subAcc[key] = srcVal
      }
      return subAcc
    }, acc)
  }, target)
}

/**
 * 
 * @description 读取ci配置
 * @param name 
 * @returns 
 */
export function readConfig(name: string = "taro-ci") {
  const config = require(path.resolve(`./${name}.config.js`));
  const { PLATFORM_ENV, MODE_ENV = "" } = process.env;
  let opts = typeof config === 'function' ? config(merge) : config;
  let { info = {} } = opts;
  try {
    // 使用发布配置项
    if (PLATFORM_ENV) {
      const type = PLATFORM_ENV + (MODE_ENV ? `.${MODE_ENV}` : "");
      info = info[type] || info;
    }
  } catch (error) { }
  return {
    info
  };
}

/**
 * 
 * @description 获取404模板
 * @returns 
 */
function get404Template(): string {
  const { ctx } = ref.current;
  const { paths: { sourcePath } } = ctx
  return `${sourcePath}/404.jsx`;
}

/**
 * 
 * @description 检查404是否可用
 * @param pages 
 * @returns 
 */
function check404Need(pages: Array<string>): boolean {
  return fs.existsSync(get404Template()) && pages && pages.length > 0
}
/**
 * 
 * @description 复制404页面
 * @param item 
 * @returns 
 */
export async function copy404Page() {
  const { ctx } = ref.current;
  const { info } = readConfig();
  const pages = info["404"];
  const path404 = get404Template();
  ref.current.pages = pages;
  if (check404Need(pages)) {
    const { paths: { sourcePath } } = ctx;
    pages.forEach(url => {
      fs.copySync(path404, `${sourcePath}/${url}.jsx`);
    });
  }
}

/**
  *
  * @param {*} url
  */
function deleteFolderRecursive(url) {
  try {
    if (fs.existsSync(url)) {
      if (fs.statSync(url).isDirectory()) {
        const files = fs.readdirSync(url);
        if (files.length > 0) {
          return
        }
        fs.rmdirSync(url);
      } else {
        fs.unlinkSync(url);
      }
      deleteFolderRecursive(url.replace(FILE_NAME_REG, ""))
    }
  } catch (error) {

  }
}

/**
 * 
 * @description 移除动态创建的404页面
 * @param item 
 * @returns 
 */
export async function remove404Page() {
  const { pages } = ref.current;
  if (check404Need(pages)) {
    pages.forEach(url => {
      const toPath = path.resolve(`./src/${url}.jsx`);
      deleteFolderRecursive(toPath);
    });
  }
}