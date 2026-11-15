"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTreeWorkspaceHost = createTreeWorkspaceHost;
const core_1 = require("@angular-devkit/core");
function createTreeWorkspaceHost(tree) {
    const directories = new Set(['/']);
    tree.visit((filePath) => {
        const segments = filePath.split('/').filter(Boolean);
        let current = '';
        for (const segment of segments.slice(0, -1)) {
            current += `/${segment}`;
            directories.add(current);
        }
    });
    return core_1.virtualFs.createSyncHost({
        read(path) {
            const content = tree.read(path);
            if (content === null)
                throw new Error(`File not found in schematic tree: ${path}`);
            return Uint8Array.from(content).buffer;
        },
        list(path) {
            const directory = tree.getDir(path);
            return [...directory.subdirs, ...directory.subfiles];
        },
        exists: (path) => tree.exists(path) || directories.has(path),
        isDirectory: (path) => directories.has(path),
        isFile: (path) => tree.exists(path),
        stat: () => null,
        write() {
            throw new Error('Workspace discovery is read-only.');
        },
        delete() {
            throw new Error('Workspace discovery is read-only.');
        },
        rename() {
            throw new Error('Workspace discovery is read-only.');
        },
    });
}
