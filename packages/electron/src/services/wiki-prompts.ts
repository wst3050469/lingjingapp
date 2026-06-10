// Wiki LLM prompt templates for generating project documentation

export interface FileInfo {
  path: string;
  content: string;
}

export interface ModuleSummary {
  path: string;
  title: string;
  fileCount: number;
}

export function buildModulePrompt(modulePath: string, files: FileInfo[], lang: 'en' | 'zh'): string {
  const fileList = files.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');

  if (lang === 'zh') {
    return `你是一个技术文档专家。请为以下代码模块生成结构化的技术文档。

## 模块路径: ${modulePath}

## 包含的源文件:
${fileList}

## 要求:
1. 用 Markdown 格式输出
2. 包含以下部分:
   - **模块概述**: 简要描述该模块的用途和职责
   - **核心组件**: 列出主要的类、函数、接口及其功能
   - **数据流**: 描述模块内的数据流向（如适用）
   - **依赖关系**: 列出该模块依赖的外部模块
   - **关键实现细节**: 值得注意的设计模式或技术决策
3. 内容简洁准确，面向开发者
4. 不要输出任何前缀说明或后缀总结，直接输出 Markdown 文档内容`;
  }

  return `You are a technical documentation expert. Generate structured documentation for the following code module.

## Module Path: ${modulePath}

## Source Files:
${fileList}

## Requirements:
1. Output in Markdown format
2. Include these sections:
   - **Module Overview**: Brief description of purpose and responsibilities
   - **Core Components**: List main classes, functions, interfaces and their roles
   - **Data Flow**: Describe data flow within the module (if applicable)
   - **Dependencies**: List external module dependencies
   - **Key Implementation Details**: Notable design patterns or technical decisions
3. Be concise and accurate, targeting developers
4. Output the Markdown document content directly without any prefix or suffix`;
}

export function buildOverviewPrompt(modules: ModuleSummary[], lang: 'en' | 'zh'): string {
  const moduleList = modules.map((m) => `- **${m.path}**: ${m.title} (${m.fileCount} files)`).join('\n');

  if (lang === 'zh') {
    return `你是一个技术文档专家。请根据以下模块列表生成项目总览文档。

## 项目模块:
${moduleList}

## 要求:
1. 用 Markdown 格式输出
2. 包含以下部分:
   - **项目概述**: 简要描述整个项目的用途和架构
   - **模块结构**: 以表格或列表形式展示所有模块及其用途
   - **架构关系**: 描述模块间的主要依赖和协作关系
   - **技术栈**: 列出项目使用的主要技术和框架
3. 内容简洁清晰
4. 不要输出任何前缀说明或后缀总结，直接输出 Markdown 文档内容`;
  }

  return `You are a technical documentation expert. Generate a project overview document based on the following module list.

## Project Modules:
${moduleList}

## Requirements:
1. Output in Markdown format
2. Include these sections:
   - **Project Overview**: Brief description of the project's purpose and architecture
   - **Module Structure**: Display all modules and their purposes in a table or list
   - **Architecture Relations**: Describe main dependencies and collaborations between modules
   - **Tech Stack**: List main technologies and frameworks used
3. Be concise and clear
4. Output the Markdown document content directly without any prefix or suffix`;
}

export function buildUpdatePrompt(
  modulePath: string,
  existingContent: string,
  changedFiles: FileInfo[],
  lang: 'en' | 'zh'
): string {
  const fileList = changedFiles.map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');

  if (lang === 'zh') {
    return `你是一个技术文档专家。以下模块的代码已经发生变更，请基于现有文档进行增量更新。

## 模块路径: ${modulePath}

## 现有文档:
${existingContent}

## 变更的文件:
${fileList}

## 要求:
1. 保持现有文档的结构和风格
2. 只更新与变更文件相关的部分
3. 如果有新增的类/函数/接口，添加到相应部分
4. 如果有删除的内容，从文档中移除
5. 用 Markdown 格式输出完整的更新后文档
6. 不要输出任何前缀说明或后缀总结，直接输出更新后的 Markdown 文档`;
  }

  return `You are a technical documentation expert. The following module's code has changed. Please incrementally update the existing documentation.

## Module Path: ${modulePath}

## Existing Documentation:
${existingContent}

## Changed Files:
${fileList}

## Requirements:
1. Maintain the existing document structure and style
2. Only update sections related to changed files
3. Add new classes/functions/interfaces to appropriate sections
4. Remove deleted content from the document
5. Output the complete updated document in Markdown format
6. Output the updated Markdown document directly without any prefix or suffix`;
}
