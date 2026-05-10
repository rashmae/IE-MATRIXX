const fs = require('fs');
const path = require('path');

const targetStr = 'text-foreground/40 mt-3 text-xl font-medium tracking-tight';
const replacementStr = 'text-foreground/40 mt-2 sm:mt-3 text-base md:text-xl font-medium tracking-tight';

function walkDir(dir) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath);
        } else if (dirPath.endsWith('.tsx')) {
            let content = fs.readFileSync(dirPath, 'utf8');
            if (content.includes(targetStr)) {
                let newContent = content.replace(new RegExp(targetStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementStr);
                fs.writeFileSync(dirPath, newContent, 'utf8');
                console.log(`Updated ${dirPath}`);
            }
        }
    });
}

walkDir(path.join(__dirname, 'src', 'pages'));
