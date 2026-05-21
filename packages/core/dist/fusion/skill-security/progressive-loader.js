export class ProgressiveLoader {
    loadedSkills = new Map();
    async loadMetadata(skillPath) {
        const existing = this.loadedSkills.get(skillPath);
        if (existing) {
            return existing.metadata;
        }
        const metadata = await this.parseFrontmatter(skillPath);
        this.loadedSkills.set(skillPath, { metadata });
        return metadata;
    }
    async loadFullContent(skillPath) {
        const existing = this.loadedSkills.get(skillPath);
        if (existing?.fullContent) {
            return existing.fullContent;
        }
        const fullContent = await this.readSkillFile(skillPath);
        const metadata = await this.parseFrontmatter(skillPath);
        this.loadedSkills.set(skillPath, { metadata, fullContent });
        return fullContent;
    }
    getLoadedSkills() {
        return this.loadedSkills;
    }
    isLoaded(skillPath) {
        return this.loadedSkills.has(skillPath);
    }
    async parseFrontmatter(skillPath) {
        const content = await this.readSkillFile(skillPath);
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            return this.defaultMeta(skillPath);
        }
        try {
            const yaml = frontmatterMatch[1];
            const meta = this.parseSimpleYaml(yaml);
            return {
                name: meta.name ?? this.extractNameFromPath(skillPath),
                description: meta.description ?? '',
                triggers: meta.triggers ?? [],
                tools: meta.tools ?? [],
                level: meta.level ?? 'user',
            };
        }
        catch {
            return this.defaultMeta(skillPath);
        }
    }
    async readSkillFile(_skillPath) {
        return '';
    }
    parseSimpleYaml(yaml) {
        const result = {};
        const lines = yaml.split('\n');
        for (const line of lines) {
            const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
            if (match) {
                const key = match[1];
                const value = match[2].trim();
                if (value.startsWith('[') && value.endsWith(']')) {
                    result[key] = value.slice(1, -1).split(',').map((s) => s.trim());
                }
                else {
                    result[key] = value;
                }
            }
        }
        return result;
    }
    extractNameFromPath(skillPath) {
        const parts = skillPath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || skillPath;
    }
    defaultMeta(skillPath) {
        return {
            name: this.extractNameFromPath(skillPath),
            description: '',
            triggers: [],
            tools: [],
            level: 'user',
        };
    }
}
//# sourceMappingURL=progressive-loader.js.map