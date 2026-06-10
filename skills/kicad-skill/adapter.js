module.exports = {
  mapToCliArgs: function(toolName, params) {
    switch (toolName) {
      case 'kicad_schematic_edit':
        return ['schematic', params.action, params.filePath];
      case 'kicad_pcb_edit':
        return ['pcb', params.action, params.filePath];
      case 'kicad_drc_check':
        return ['drc', '--format', params.outputFormat || 'json', params.filePath];
      case 'kicad_bom_export':
        return ['export', 'bom', '--format', params.format || 'csv', '-o', params.outputPath || '', params.filePath];
      case 'kicad_gerber_export':
        return ['export', 'gerbers', '-o', params.outputDir || '.', params.filePath];
      case 'kicad_3d_view':
        return ['render', '3d', params.filePath];
      default:
        throw new Error('Unknown tool: ' + toolName);
    }
  },
  parseOutput: function(toolName, stdout, stderr, exitCode) {
    if (exitCode !== 0) {
      return { success: false, error: stderr || 'Command failed', exitCode };
    }
    if (toolName === 'kicad_drc_check') {
      try {
        const result = JSON.parse(stdout);
        return { success: true, violations: result.violations || [], stats: result.stats || {} };
      } catch {
        return { success: true, raw: stdout };
      }
    }
    if (toolName === 'kicad_gerber_export') {
      const files = stdout.split('\n').filter(l => l.trim());
      return { success: true, files };
    }
    return { success: true, output: stdout };
  }
};