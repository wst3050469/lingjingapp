module.exports = {
  mapToCliArgs: function(toolName, params) {
    switch (toolName) {
      case 'openscad_edit': return [params.filePath];
      case 'openscad_render_preview': return ['-o', params.outputPath || 'preview.png', '--render', params.filePath];
      case 'openscad_export': return ['-o', params.outputPath || ('output.' + (params.format || 'stl')), params.filePath];
      case 'openscad_kicad_3d_link': return ['-o', params.outputPath || 'model.wrl', '--export-format', 'wrl', params.filePath];
      default: throw new Error('Unknown tool: ' + toolName);
    }
  },
  parseOutput: function(toolName, stdout, stderr, exitCode) {
    if (exitCode !== 0) return { success: false, error: stderr, exitCode };
    return { success: true, output: stdout };
  },
  validateScriptSecurity: function(content) {
    const forbidden = ['system(', 'exec(', 'import ', 'require('];
    for (const pattern of forbidden) {
      if (content.includes(pattern)) return { allowed: false, reason: 'Forbidden pattern: ' + pattern };
    }
    return { allowed: true };
  }
};