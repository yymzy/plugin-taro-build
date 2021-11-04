import {
    copy404Page,
    fileTypeMap,
    formatPagesName,
    recursiveReplaceObjectKeys,
    resolveScriptPath,
    resolveStylePath
} from "../utils/";
import { ref } from "utils";
import path from "path";

export default (ctx, opts) => {
    ref.current = ctx;
    const { TARO_ENV, MODE_ENV, PLATFORM_ENV = TARO_ENV, ROOT_PATH, DEBUG_ENV } = process.env;

    // 更新编译环境变量
    ctx.initialConfig.env = {
        TARO_ENV, MODE_ENV, PLATFORM_ENV, ROOT_PATH, DEBUG_ENV,
        ...ctx.initialConfig.env,
    }
    if (DEBUG_ENV === 'OPEN') {
        ctx.initialConfig.uglify = {}
    }
    const { npm } = ctx.helper;
    const { nodeModulesPath } = ctx.paths;

    // 改写mini-runner中脚本路径处理方法
    const helperUtils = npm.getNpmPkgSync("@tarojs/helper", path.join(nodeModulesPath, "@tarojs/mini-runner"))
    helperUtils.resolveScriptPath = (p: string): string => resolveScriptPath(p);
    helperUtils.resolveStylePath = (p: string): string => resolveStylePath(p);

    if (PLATFORM_ENV && TARO_ENV !== PLATFORM_ENV) {
        ctx.registerPlatform({
            name: TARO_ENV,
            useConfigName: "mini",
            async fn({ config }) {
                const { appPath, nodeModulesPath, outputPath } = ctx.paths;
                const { npm, emptyDirectory } = ctx.helper;

                const projectConfigName = (key =>
                ({
                    weapp: "project.config.json",
                    alipay: "mini.project.json",
                    swan: "project.swan.json",
                    quick: "quickapp.config.json"
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

    // 支付宝特殊处理，额外修改配置项
    if (PLATFORM_ENV === "alipay") {
        ctx.modifyBuildTempFileContent(({ tempFiles }) => {
            const replaceKeyMap = {
                navigationStyle: "transparentTitle"
            };
            Object.keys(tempFiles).forEach(key => {
                const item = tempFiles[key];
                if (item.config) {
                    if (item.config.navigationStyle === 'custom') {
                        item.config.navigationBarTitleText = "";
                        item.config.navigationStyle = "always";
                        item.config.titlePenetrate = "YES";
                    }
                    recursiveReplaceObjectKeys(item.config, replaceKeyMap);
                }
            });
        });
    }

    const [changePageName = true] = opts || [];

    ctx.onBuildStart(() => {
        copy404Page();
    });

    ctx.modifyWebpackChain(({ chain }) => {
        // taro-ui 组件代码被当成副作用移除了
        chain.optimization.sideEffects(false);
    });

    ctx.onBuildFinish(() => {
        // 格式化输出的页面名称：移除TARO_ENV后缀
        changePageName && formatPagesName();
    });
};
