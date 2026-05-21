export class VersionParseError extends Error {
    constructor(version, message) {
        super(`Failed to parse version "${version}": ${message}`);
        this.name = 'VersionParseError';
    }
}
export class VersionParser {
    static VERSION_REGEX = /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;
    static parse(version) {
        const match = version.trim().match(this.VERSION_REGEX);
        if (!match) {
            throw new VersionParseError(version, 'Invalid semantic version format');
        }
        const [, majorStr, minorStr, patchStr, prerelease] = match;
        const major = parseInt(majorStr, 10);
        const minor = parseInt(minorStr, 10);
        const patch = parseInt(patchStr, 10);
        if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
            throw new VersionParseError(version, 'Invalid version numbers');
        }
        return {
            major,
            minor,
            patch,
            prerelease: prerelease || undefined,
            raw: version
        };
    }
    static compare(v1, v2) {
        if (v1.major !== v2.major) {
            return v1.major - v2.major;
        }
        if (v1.minor !== v2.minor) {
            return v1.minor - v2.minor;
        }
        if (v1.patch !== v2.patch) {
            return v1.patch - v2.patch;
        }
        if (v1.prerelease && !v2.prerelease) {
            return -1;
        }
        if (!v1.prerelease && v2.prerelease) {
            return 1;
        }
        if (v1.prerelease && v2.prerelease) {
            return v1.prerelease.localeCompare(v2.prerelease);
        }
        return 0;
    }
    static compareVersions(version1, version2) {
        const v1 = this.parse(version1);
        const v2 = this.parse(version2);
        return this.compare(v1, v2);
    }
    static isGreaterThan(version1, version2) {
        return this.compareVersions(version1, version2) > 0;
    }
    static isLessThan(version1, version2) {
        return this.compareVersions(version1, version2) < 0;
    }
    static isEqual(version1, version2) {
        return this.compareVersions(version1, version2) === 0;
    }
    static needsUpgrade(currentVersion, latestVersion) {
        try {
            const current = this.parse(currentVersion);
            const latest = this.parse(latestVersion);
            if (current.prerelease && !latest.prerelease) {
                return true;
            }
            return this.compare(latest, current) > 0;
        }
        catch (error) {
            console.error('[VersionParser] Error comparing versions:', error);
            return false;
        }
    }
    static format(version) {
        let formatted = `v${version.major}.${version.minor}.${version.patch}`;
        if (version.prerelease) {
            formatted += `-${version.prerelease}`;
        }
        return formatted;
    }
    static isValid(version) {
        try {
            this.parse(version);
            return true;
        }
        catch {
            return false;
        }
    }
    static getNextPatch(version) {
        const v = this.parse(version);
        return this.format({
            major: v.major,
            minor: v.minor,
            patch: v.patch + 1,
            raw: ''
        });
    }
    static getNextMinor(version) {
        const v = this.parse(version);
        return this.format({
            major: v.major,
            minor: v.minor + 1,
            patch: 0,
            raw: ''
        });
    }
    static getNextMajor(version) {
        const v = this.parse(version);
        return this.format({
            major: v.major + 1,
            minor: 0,
            patch: 0,
            raw: ''
        });
    }
}
//# sourceMappingURL=version-parser.js.map