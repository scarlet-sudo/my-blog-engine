import markdown from 'markdown-it'
import fs from 'node:fs/promises'
import {EOL} from "node:os";
import hljs from 'highlight.js'
import ejs from 'ejs'
import path from "node:path";

const buildPath = path.join(import.meta.dirname, '..', 'build')
const markdownPath = path.join(import.meta.dirname, 'markdown')
const templatePath = path.join(import.meta.dirname, 'template')

type BlogData = {
    title: string
    date: string
    content: string
}

async function clearBuild() {
    // 删除 build 目录
    await fs.rm(buildPath, {recursive: true, force: true})
    await fs.mkdir(buildPath)
    await fs.mkdir(path.join(buildPath, 'posts'))
}

async function resolveMarkdownText(raw: string): Promise<BlogData> {
    // 读取markdown文件内容，并且去掉开头的空行
    let lines = raw.trimStart().split('\n')
    // 清除行尾换行符
    lines = lines.map(e => e.trimEnd())
    let blogInfo: BlogData = {date: "", title: "", content: ""}
    if (lines.length === 0) {
        return blogInfo
    }
    if (lines[0] === '---') {
        for (let i = 1; i < lines.length; i++) {
            if (lines[i] === '---') {
                lines = lines.slice(i + 1)
                break
            }
            let metadata = lines[i].split(':')
            let key = metadata[0].trim()
            let value = metadata[1].trim()
            if (key === 'title') {
                blogInfo.title = value
            } else if (key === 'date') {
                blogInfo.date = value
            }
        }
    }
    blogInfo.content = lines.join(EOL)
    return blogInfo
}

await clearBuild()

//@ts-ignore
const md = markdown({
    html: true,
    linkify: true,
    typographer: true,
    // @ts-ignore
    highlight: function (str, lang) {
        const language = hljs.getLanguage(lang) ? lang : undefined;
        try {
            const highlightedCode = language
                ? hljs.highlight(str, {language}).value
                : hljs.highlightAuto(str).value;

            return `<pre class="hljs" style="padding: 10px"><code>${highlightedCode}</code></pre>`;
        } catch (__) {
            // 如果有错误发生，就返回没有高亮的原始字符串
            return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
        }
    }
})
// 读取模板文件
const template = await fs.readFile(path.join(templatePath, 'post.ejs'), 'utf-8');

// 读取 markdown 文件夹下的所有 .md 文件
const markdownFiles = await fs.readdir(markdownPath);
const mdFiles = markdownFiles.filter(file => path.extname(file).toLowerCase() === '.md');

// 创建一个数组存储所有文章的信息
const blogs = [];

// 在处理完每个Markdown文件后，将信息添加到数组中
for (const file of mdFiles) {
    // 读取 Markdown 文件内容
    const raw = await fs.readFile(path.join(markdownPath, file), 'utf-8');

    // 解析 Markdown 文件并转换为 HTML
    const blogInfo = await resolveMarkdownText(raw);
    const result = md.render(blogInfo.content);

    // 使用 EJS 渲染最终的 HTML
    const renderedHtml = ejs.render(template, {title: blogInfo.title, content: result, date: blogInfo.date});

    // 确定输出文件名（例如将 test.md 转换为 test.html）
    const outputFileName = path.basename(file, path.extname(file)) + '.html';
    const outputPath = path.join(buildPath, 'posts', outputFileName);

    // 将文章信息存储起来用于生成索引页
    blogs.push({title: blogInfo.title, url: `posts/${outputFileName}`, date: blogInfo.date});

    // 写入生成的 HTML 文件
    await fs.writeFile(outputPath, renderedHtml);
    console.log(`Generated ${outputPath}`);
}

// 现在所有 Markdown 文件都已处理完毕，可以生成 index.html
const indexPath = path.join(buildPath, 'index.html')
const indexTemplate = await fs.readFile(path.join(templatePath, 'index.ejs'), 'utf-8');

// 写入索引页
await fs.writeFile(indexPath, ejs.render(indexTemplate, {blogs: blogs}));
console.log(`Generated ${indexPath}`);