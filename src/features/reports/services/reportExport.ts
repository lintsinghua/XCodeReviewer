import type { AuditTask, AuditIssue } from "@/shared/types";

// 导出 JSON 格式报告
export async function exportToJSON(task: AuditTask, issues: AuditIssue[]) {
    const report = {
        metadata: {
            exportDate: new Date().toISOString(),
            version: "1.0.0",
            format: "JSON"
        },
        task: {
            id: task.id,
            projectName: task.project?.name || "未知项目",
            taskType: task.task_type,
            status: task.status,
            branchName: task.branch_name,
            createdAt: task.created_at,
            completedAt: task.completed_at,
            qualityScore: task.quality_score,
            totalFiles: task.total_files,
            scannedFiles: task.scanned_files,
            totalLines: task.total_lines,
            issuesCount: task.issues_count
        },
        issues: issues.map(issue => ({
            id: issue.id,
            title: issue.title,
            description: issue.description,
            severity: issue.severity,
            issueType: issue.issue_type,
            filePath: issue.file_path,
            lineNumber: issue.line_number,
            columnNumber: issue.column_number,
            codeSnippet: issue.code_snippet,
            suggestion: issue.suggestion,
            aiExplanation: issue.ai_explanation
        })),
        summary: {
            totalIssues: issues.length,
            critical: issues.filter(i => i.severity === "critical").length,
            high: issues.filter(i => i.severity === "high").length,
            medium: issues.filter(i => i.severity === "medium").length,
            low: issues.filter(i => i.severity === "low").length,
            byType: {
                security: issues.filter(i => i.issue_type === "security").length,
                bug: issues.filter(i => i.issue_type === "bug").length,
                performance: issues.filter(i => i.issue_type === "performance").length,
                style: issues.filter(i => i.issue_type === "style").length,
                maintainability: issues.filter(i => i.issue_type === "maintainability").length
            }
        }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-report-${task.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 导出 PDF 格式报告（使用隐藏 iframe 打印）
export async function exportToPDF(task: AuditTask, issues: AuditIssue[]) {
    const criticalIssues = issues.filter(i => i.severity === "critical");
    const highIssues = issues.filter(i => i.severity === "high");
    const mediumIssues = issues.filter(i => i.severity === "medium");
    const lowIssues = issues.filter(i => i.severity === "low");

    const html = generateReportHTML(task, issues, criticalIssues, highIssues, mediumIssues, lowIssues);

    // 创建隐藏的 iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(html);
        iframeDoc.close();

        // 等待内容加载完成后打印
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow?.print();
                // 打印对话框关闭后移除 iframe
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 250);
        };
    }
}

// 生成报告 HTML（简化版）
function generateReportHTML(
    task: AuditTask,
    issues: AuditIssue[],
    criticalIssues: AuditIssue[],
    highIssues: AuditIssue[],
    mediumIssues: AuditIssue[],
    lowIssues: AuditIssue[]
): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>代码审计报告</title>
    <style>
        @page {
            margin: 2cm;
            size: A4;
        }
        @media print {
            body {
                margin: 0;
                padding: 20px;
            }
        }
        body {
            font-family: "Microsoft YaHei", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
        }
        h1 {
            color: #dc2626;
            border-bottom: 3px solid #dc2626;
            padding-bottom: 10px;
            margin-bottom: 30px;
        }
        h2 {
            color: #dc2626;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        h3 {
            color: #374151;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .info-section {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .info-item {
            margin-bottom: 10px;
        }
        .info-label {
            font-weight: bold;
            color: #6b7280;
            display: inline-block;
            width: 120px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #dc2626;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background: #f9fafb;
        }
        .issue {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .issue-title {
            font-size: 16px;
            font-weight: bold;
            color: #111827;
        }
        .severity {
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .severity-critical {
            background: #fee2e2;
            color: #991b1b;
        }
        .severity-high {
            background: #fed7aa;
            color: #9a3412;
        }
        .severity-medium {
            background: #fef3c7;
            color: #92400e;
        }
        .severity-low {
            background: #dbeafe;
            color: #1e40af;
        }
        .issue-meta {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .code-block {
            background: #1f2937;
            color: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 10px 0;
            font-family: "Courier New", monospace;
            font-size: 13px;
        }
        .suggestion {
            background: #dbeafe;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>代码审计报告</h1>
    
    <div class="info-section">
        <h2>项目信息</h2>
        <div class="info-item">
            <span class="info-label">项目名称:</span>
            <span>${task.project?.name || "未知项目"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">任务ID:</span>
            <span>${task.id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">分支:</span>
            <span>${task.branch_name || "默认分支"}</span>
        </div>
        <div class="info-item">
            <span class="info-label">创建时间:</span>
            <span>${new Date(task.created_at).toLocaleString("zh-CN")}</span>
        </div>
        ${task.completed_at ? `
        <div class="info-item">
            <span class="info-label">完成时间:</span>
            <span>${new Date(task.completed_at).toLocaleString("zh-CN")}</span>
        </div>
        ` : ""}
    </div>

    <h2>审计统计</h2>
    <table>
        <tr>
            <th>指标</th>
            <th>数值</th>
            <th>指标</th>
            <th>数值</th>
        </tr>
        <tr>
            <td>质量评分</td>
            <td>${(task.quality_score || 0).toFixed(1)}/100</td>
            <td>扫描文件</td>
            <td>${task.scanned_files || 0}/${task.total_files || 0}</td>
        </tr>
        <tr>
            <td>代码行数</td>
            <td>${(task.total_lines || 0).toLocaleString()}</td>
            <td>发现问题</td>
            <td>${task.issues_count || 0}</td>
        </tr>
        <tr>
            <td>严重问题</td>
            <td>${criticalIssues.length}</td>
            <td>高优先级</td>
            <td>${highIssues.length}</td>
        </tr>
        <tr>
            <td>中等优先级</td>
            <td>${mediumIssues.length}</td>
            <td>低优先级</td>
            <td>${lowIssues.length}</td>
        </tr>
    </table>

    ${issues.length > 0 ? `
    <h2>问题详情</h2>
    
    ${criticalIssues.length > 0 ? `
    <h3>严重问题 (${criticalIssues.length})</h3>
    ${criticalIssues.map(issue => generateIssueHTML(issue, "critical")).join("")}
    ` : ""}
    
    ${highIssues.length > 0 ? `
    <h3>高优先级问题 (${highIssues.length})</h3>
    ${highIssues.map(issue => generateIssueHTML(issue, "high")).join("")}
    ` : ""}
    
    ${mediumIssues.length > 0 ? `
    <h3>中等优先级问题 (${mediumIssues.length})</h3>
    ${mediumIssues.map(issue => generateIssueHTML(issue, "medium")).join("")}
    ` : ""}
    
    ${lowIssues.length > 0 ? `
    <h3>低优先级问题 (${lowIssues.length})</h3>
    ${lowIssues.map(issue => generateIssueHTML(issue, "low")).join("")}
    ` : ""}
    ` : `
    <div class="info-section">
        <h3>✅ 代码质量优秀！</h3>
        <p>恭喜！没有发现任何问题。您的代码通过了所有质量检查。</p>
    </div>
    `}

    <div class="footer">
        <p><strong>报告生成时间:</strong> ${new Date().toLocaleString("zh-CN")}</p>
    </div>
</body>
</html>
    `;
}

// 生成问题的 HTML
function generateIssueHTML(issue: AuditIssue, severity: string): string {
    return `
    <div class="issue">
        <div class="issue-header">
            <div class="issue-title">${escapeHtml(issue.title)}</div>
            <span class="severity severity-${severity}">
                ${severity === "critical" ? "严重" : severity === "high" ? "高" : severity === "medium" ? "中等" : "低"}
            </span>
        </div>
        <div class="issue-meta">
            📁 ${escapeHtml(issue.file_path)}
            ${issue.line_number ? ` | 📍 第 ${issue.line_number} 行` : ""}
            ${issue.column_number ? `，第 ${issue.column_number} 列` : ""}
        </div>
        ${issue.description ? `
        <p><strong>问题描述:</strong> ${escapeHtml(issue.description)}</p>
        ` : ""}
        ${issue.code_snippet ? `
        <div class="code-block"><pre>${escapeHtml(issue.code_snippet)}</pre></div>
        ` : ""}
        ${issue.suggestion ? `
        <div class="suggestion">
            <strong>💡 修复建议:</strong><br>
            ${escapeHtml(issue.suggestion)}
        </div>
        ` : ""}
    </div>
    `;
}

// HTML 转义
function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
