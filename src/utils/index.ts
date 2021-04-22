import { IPluginContext } from '@tarojs/service';
import { PagePathOptions } from 'types';
import path from "path";

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
 * 
 * @description 处理新旧页面路径
 * @param opts 
 * @param env 
 * @returns 
 */
function resolvePagePath(opts: PagePathOptions, env: string = ""): string {
  const { outputPath, pagePath, suffix } = opts;
  return path.resolve(outputPath, pagePath + (env ? `.${env}` : "") + suffix);
}

/**
 * @description 组装页面路径
 */
export function formatPagesName(ctx: IPluginContext) {
  const { outputPath } = ctx.paths;
  const { TARO_ENV, PLATFORM_ENV } = process.env;
  const { fs: { readJson, renameSync, existsSync } } = ctx.helper;
  const fileType = fileTypeMap[PLATFORM_ENV];

  readJson(path.resolve(outputPath, "./app.json")).then(({ pages }) => {
    pages.map(pagePath => {
      Object.keys(fileType).map(key => {
        try {
          const suffix = fileType[key];
          const opts = { outputPath, pagePath, suffix };
          const oldPath = resolvePagePath(opts, TARO_ENV);
          const newPath = resolvePagePath(opts);
          if (existsSync(oldPath)) {
            renameSync(oldPath, newPath)
          }
        } catch (error) {
          console.log(error.message);
        }
      })
    })
  })
}

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