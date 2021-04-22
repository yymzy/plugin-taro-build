import { IPluginContext } from '@tarojs/service';
import { fileTypeMap, formatPagesName, recursiveReplaceObjectKeys } from "../../utils/";

const build = (ctx: IPluginContext, opts) => {
  const { TARO_ENV, MODE_ENV, PLATFORM_ENV, ROOT_PATH } = process.env;
  if (TARO_ENV !== PLATFORM_ENV) {
    ctx.registerPlatform({
      name: TARO_ENV,
      useConfigName: "mini",
      async fn({ config }) {
        const { appPath, nodeModulesPath, outputPath } = ctx.paths;
        const { npm, emptyDirectory } = ctx.helper;

        const projectConfigName = (key =>
        ({
          weapp: "project.config.json",
          alipay: "mini.project.json"
        }[key]))(PLATFORM_ENV);

        // 清空输出包
        emptyDirectory(outputPath);

        // 拷贝配置文件
        if (projectConfigName) {
          ctx.generateProjectConfig({
            srcConfigName: projectConfigName,
            distConfigName: projectConfigName
          });
        }

        // 准备 miniRunner 参数
        const miniRunnerOpts = {
          ...config,
          env: {
            ...config.env,
            MODE_ENV,
            PLATFORM_ENV,
            ROOT_PATH
          },
          nodeModulesPath,
          buildAdapter: PLATFORM_ENV,
          isBuildPlugin: false,
          fileType: fileTypeMap[PLATFORM_ENV],
          isUseComponentBuildPage: true
        };

        if (PLATFORM_ENV === "alipay") {
          // 支付宝特殊处理
          miniRunnerOpts.isUseComponentBuildPage = false;
          miniRunnerOpts.globalObject = "my";
          ctx.modifyBuildTempFileContent(({ tempFiles }) => {
            const replaceKeyMap = {
              navigationBarTitleText: "defaultTitle",
              navigationBarBackgroundColor: "titleBarColor",
              enablePullDownRefresh: "pullRefresh",
              list: "items",
              text: "name",
              iconPath: "icon",
              selectedIconPath: "activeIcon",
              color: "textColor"
            };

            Object.keys(tempFiles).forEach(key => {
              const item = tempFiles[key];
              if (item.config) {
                recursiveReplaceObjectKeys(item.config, replaceKeyMap);
              }
            });
          });
        }

        // build with webpack
        const miniRunner = await npm.getNpmPkg("@tarojs/mini-runner", appPath);
        await miniRunner(appPath, miniRunnerOpts);
      }
    });
  }



  ctx.onBuildFinish(() => {
    // 格式化输出的页面名称：移除TARO_ENV后缀
    formatPagesName(ctx)
  });
};

export default build
