var e=require('child_process').execSync;var c='D:/lingjing/lingjing';
// Commit all pending deletions and modifications
e('git add -A',{cwd:c,stdio:'inherit'});
e('git commit -m "chore: cleanup working tree - remove old OpenSpace IPC/renderer/skills" -m "- Remove openspace-ipc.ts, OpenSpacePanel.tsx (replaced by fusion-adapter)\n- Remove old OpenSpace skills (navigate, record, scene)\n- Remove migration004\n- Sync remaining local modifications"',{cwd:c,stdio:'inherit'});
e('git push origin main',{cwd:c,stdio:'inherit'});
