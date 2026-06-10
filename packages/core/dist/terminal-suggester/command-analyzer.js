import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export class CommandAnalyzer {
    analyze(intent, projectRoot) {
        const context = this.buildProjectContext(projectRoot);
        const suggestions = [];
        if (/install|add|依赖/.test(intent)) {
            const pm = context.packageManager;
            suggestions.push({
                command: `${pm} install`,
                description: `使用 ${pm} 安装依赖`,
                type: 'install',
                riskLevel: 'safe',
                projectContext: context,
            });
        }
        if (/build|构建|编译/.test(intent)) {
            const buildCmd = context.scripts['build'] ? `npm run build` : 'tsc';
            suggestions.push({
                command: buildCmd,
                description: '构建项目',
                type: 'build',
                riskLevel: 'safe',
                estimatedTime: '30s',
                projectContext: context,
            });
        }
        if (/test|测试/.test(intent)) {
            suggestions.push({
                command: context.scripts['test'] ? 'npm test' : 'jest',
                description: '运行测试',
                type: 'test',
                riskLevel: 'safe',
                estimatedTime: '60s',
                projectContext: context,
            });
        }
        if (/lint|检查|规范/.test(intent)) {
            suggestions.push({
                command: context.scripts['lint'] ? 'npm run lint' : 'eslint .',
                description: '运行代码检查',
                type: 'lint',
                riskLevel: 'safe',
                projectContext: context,
            });
        }
        return suggestions;
    }
    buildProjectContext(projectRoot) {
        const pkgPath = join(projectRoot, 'package.json');
        let scripts = {};
        let packageManager = 'npm';
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                scripts = pkg.scripts ?? {};
            }
            catch { }
        }
        if (existsSync(join(projectRoot, 'pnpm-lock.yaml')))
            packageManager = 'pnpm';
        else if (existsSync(join(projectRoot, 'yarn.lock')))
            packageManager = 'yarn';
        return {
            packageManager,
            hasPackageJson: existsSync(pkgPath),
            scripts,
            language: 'typescript',
        };
    }
}
//# sourceMappingURL=command-analyzer.js.map