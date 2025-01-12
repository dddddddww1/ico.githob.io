class IconGenerator {
    constructor() {
        this.canvas = document.getElementById('iconCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupEventListeners();
        this.initializeEditor();
        this.setupSizeValidation();
        this.setupSizeSelector();
        this.setupAIGeneration();
    }

    setupEventListeners() {
        document.getElementById('generate').addEventListener('click', () => this.generateIcon());
        document.getElementById('download').addEventListener('click', () => this.downloadIcon());
        document.getElementById('edit').addEventListener('click', () => this.openEditor());
        document.getElementById('closeEditor').addEventListener('click', () => this.closeEditor());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        document.getElementById('clearCanvas').addEventListener('click', () => this.clearEditorCanvas());

        // 画板事件监听
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
    }

    generateIcon() {
        const bgColor = document.getElementById('bgColor').value;
        const shapeColor = document.getElementById('shapeColor').value;
        const shape = document.getElementById('shape').value;

        // 清空画布
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制形状
        this.ctx.fillStyle = shapeColor;
        const center = this.canvas.width / 2;
        const size = this.canvas.width * 0.6;

        switch(shape) {
            case 'circle':
                this.drawCircle(center, center, size / 2);
                break;
            case 'square':
                this.drawSquare(center - size/2, center - size/2, size);
                break;
            case 'triangle':
                this.drawTriangle(center, center - size/2, size);
                break;
        }
    }

    drawCircle(x, y, radius) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawSquare(x, y, size) {
        this.ctx.fillRect(x, y, size, size);
    }

    drawTriangle(x, y, size) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x - size/2, y + size);
        this.ctx.lineTo(x + size/2, y + size);
        this.ctx.closePath();
        this.ctx.fill();
    }

    downloadIcon() {
        // 获取选中的尺寸
        const selectedSizes = Array.from(document.getElementsByName('iconSize'))
            .filter(checkbox => checkbox.checked)
            .map(checkbox => parseInt(checkbox.value));

        // 确保至少选择了一个尺寸
        if (selectedSizes.length === 0) {
            alert('请至少选择一个图标尺寸！');
            return;
        }

        // 创建一个临时 canvas
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // 创建一个 Blob 数组来存储不同尺寸的图标数据
        const iconData = [];
        
        // 为每个选中的尺寸生成图标
        selectedSizes.forEach(size => {
            tempCanvas.width = size;
            tempCanvas.height = size;
            tempCtx.drawImage(this.canvas, 0, 0, size, size);
            
            // 获取图像数据
            const imageData = tempCtx.getImageData(0, 0, size, size);
            const data = this.createICO(size, imageData.data);
            iconData.push(data);
        });

        // 合并所有尺寸的图标数据
        const ico = this.combineICO(iconData);
        
        // 创建并触发下载
        const blob = new Blob([ico], { type: 'image/x-icon' });
        const link = document.createElement('a');
        link.download = 'icon.ico';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // 添加创建 ICO 格式数据的方法
    createICO(size, pixelData) {
        const headerSize = 6;
        const dirEntrySize = 16;
        const bmpHeaderSize = 40;
        const pixelDataSize = size * size * 4;
        
        const data = new ArrayBuffer(bmpHeaderSize + pixelDataSize);
        const view = new DataView(data);
        
        // 写入 BMP 头部信息
        view.setUint32(0, bmpHeaderSize, true); // 头部大小
        view.setInt32(4, size, true); // 宽度
        view.setInt32(8, size * 2, true); // 高度（*2 是因为 ICO 格式需要）
        view.setUint16(12, 1, true); // 颜色平面
        view.setUint16(14, 32, true); // 每像素位数
        view.setUint32(16, 0, true); // 压缩方式
        view.setUint32(20, pixelDataSize, true); // 图像数据大小
        
        // 写入像素数据
        const pixels = new Uint8Array(data, bmpHeaderSize);
        for (let i = 0; i < pixelData.length; i += 4) {
            const row = Math.floor(i / 4 / size);
            const col = (i / 4) % size;
            const targetIndex = ((size - row - 1) * size + col) * 4;
            
            pixels[targetIndex] = pixelData[i + 2]; // B
            pixels[targetIndex + 1] = pixelData[i + 1]; // G
            pixels[targetIndex + 2] = pixelData[i]; // R
            pixels[targetIndex + 3] = pixelData[i + 3]; // A
        }
        
        return {
            size: size,
            data: new Uint8Array(data)
        };
    }

    // 添加合并多个尺寸图标的方法
    combineICO(iconDataArray) {
        const headerSize = 6;
        const dirEntrySize = 16;
        
        // 计算总大小
        let totalSize = headerSize + dirEntrySize * iconDataArray.length;
        let imageDataOffset = totalSize;
        
        // 计算所有图像数据的总大小
        const imageSizes = iconDataArray.reduce((acc, icon) => acc + icon.data.length, 0);
        totalSize += imageSizes;
        
        // 创建最终的 ICO 文件数据
        const ico = new ArrayBuffer(totalSize);
        const view = new DataView(ico);
        
        // 写入 ICO 头部
        view.setUint16(0, 0, true); // 保留字段
        view.setUint16(2, 1, true); // 图标类型（1 = ICO）
        view.setUint16(4, iconDataArray.length, true); // 图像数量
        
        // 写入目录条目
        let offset = headerSize;
        let dataOffset = imageDataOffset;
        
        iconDataArray.forEach(icon => {
            const size = icon.size;
            
            // 写入目录条目
            view.setUint8(offset, size); // 宽度
            view.setUint8(offset + 1, size); // 高度
            view.setUint8(offset + 2, 0); // 调色板大小
            view.setUint8(offset + 3, 0); // 保留字段
            view.setUint16(offset + 4, 1, true); // 颜色平面
            view.setUint16(offset + 6, 32, true); // 每像素位数
            view.setUint32(offset + 8, icon.data.length, true); // 图像数据大小
            view.setUint32(offset + 12, dataOffset, true); // 图像数据偏移量
            
            // 复制图像数据
            new Uint8Array(ico, dataOffset).set(icon.data);
            
            offset += dirEntrySize;
            dataOffset += icon.data.length;
        });
        
        return new Uint8Array(ico);
    }

    initializeEditor() {
        this.editorCanvas = document.getElementById('editorCanvas');
        this.editorCtx = this.editorCanvas.getContext('2d');
        this.isDrawing = false;
        this.setupEditorEventListeners();
    }

    setupEditorEventListeners() {
        // 添加到现有的 setupEventListeners 方法中
        document.getElementById('edit').addEventListener('click', () => this.openEditor());
        document.getElementById('closeEditor').addEventListener('click', () => this.closeEditor());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        document.getElementById('clearCanvas').addEventListener('click', () => this.clearEditorCanvas());

        // 画板事件监听
        this.editorCanvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.editorCanvas.addEventListener('mousemove', (e) => this.draw(e));
        this.editorCanvas.addEventListener('mouseup', () => this.stopDrawing());
        this.editorCanvas.addEventListener('mouseout', () => this.stopDrawing());
    }

    openEditor() {
        const modal = document.getElementById('editorModal');
        modal.style.display = 'block';
        
        // 将当前图标复制到编辑器画布
        this.editorCtx.clearRect(0, 0, this.editorCanvas.width, this.editorCanvas.height);
        this.editorCtx.drawImage(
            this.canvas, 
            0, 0, this.canvas.width, this.canvas.height,
            0, 0, this.editorCanvas.width, this.editorCanvas.height
        );
    }

    closeEditor() {
        document.getElementById('editorModal').style.display = 'none';
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.editorCanvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.editorCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.editorCtx.beginPath();
        this.editorCtx.strokeStyle = document.getElementById('brushColor').value;
        this.editorCtx.lineWidth = document.getElementById('brushSize').value;
        this.editorCtx.lineCap = 'round';
        this.editorCtx.moveTo(this.lastX, this.lastY);
        this.editorCtx.lineTo(x, y);
        this.editorCtx.stroke();

        this.lastX = x;
        this.lastY = y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    clearEditorCanvas() {
        this.editorCtx.clearRect(0, 0, this.editorCanvas.width, this.editorCanvas.height);
    }

    saveEdit() {
        // 将编辑器画布的内容缩放并复制到主画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(
            this.editorCanvas,
            0, 0, this.editorCanvas.width, this.editorCanvas.height,
            0, 0, this.canvas.width, this.canvas.height
        );
        this.closeEditor();
    }

    // 添加尺寸选择器的验证方法
    setupSizeValidation() {
        const checkboxes = document.getElementsByName('iconSize');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const checked = Array.from(checkboxes).filter(cb => cb.checked);
                if (checked.length === 0) {
                    alert('请至少选择一个图标尺寸！');
                    checkbox.checked = true;
                }
            });
        });
    }

    setupSizeSelector() {
        const toggleButton = document.getElementById('toggleSizes');
        const sizeSelector = document.querySelector('.size-selector');
        const selectedSizesText = document.querySelector('.selected-sizes');

        // 切换尺寸选择器的显示/隐藏
        toggleButton.addEventListener('click', () => {
            sizeSelector.classList.toggle('show');
            toggleButton.classList.toggle('active');
        });

        // 点击外部关闭尺寸选择器
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.size-selector-wrapper')) {
                sizeSelector.classList.remove('show');
                toggleButton.classList.remove('active');
            }
        });

        // 更新已选择的尺寸显示
        const updateSelectedSizes = () => {
            const selectedSizes = Array.from(document.getElementsByName('iconSize'))
                .filter(cb => cb.checked)
                .map(cb => `${cb.value}x${cb.value}`);
            selectedSizesText.textContent = `已选择: ${selectedSizes.join(', ')}`;
        };

        // 为每个复选框添加更新事件
        document.getElementsByName('iconSize').forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedSizes);
        });

        // 初始化显示
        updateSelectedSizes();
    }

    setupAIGeneration() {
        const generateAIBtn = document.getElementById('generateAI');
        const randomBtn = document.getElementById('randomIcon');
        const aiPrompt = document.getElementById('aiPrompt');

        generateAIBtn.addEventListener('click', () => this.generateAIIcon());
        randomBtn.addEventListener('click', () => this.generateRandomIcon());
        aiPrompt.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.generateAIIcon();
            }
        });
    }

    async generateAIIcon() {
        let prompt = document.getElementById('aiPrompt').value.trim();
        
        // 替换输入内容中的"正方形"为"方形"
        if (prompt.includes('正方形')) {
            prompt = prompt.replace(/正方形/g, '方形');
            // 更新输入框显示
            document.getElementById('aiPrompt').value = prompt;
        }

        if (!prompt) {
            alert('请输入图标描述！');
            return;
        }

        const generateAIBtn = document.getElementById('generateAI');
        generateAIBtn.classList.add('loading');

        try {
            const iconDescription = await this.getAIIconDescription(prompt);
            await this.drawAIIcon(iconDescription);
        } catch (error) {
            console.error('AI 生成图标失败:', error);
            alert('生成图标失败，请重试！');
        } finally {
            generateAIBtn.classList.remove('loading');
        }
    }

    async getAIIconDescription(prompt) {
        // 关键词分析
        const keywords = this.analyzePrompt(prompt.toLowerCase());
        
        // 生成图标描述
        return this.generateIconSpec(keywords);
    }

    // 修改和扩展关键词分析方法
    analyzePrompt(prompt) {
        const keywords = {
            colors: [],
            shapes: [],
            style: 'simple',
            size: 'medium',
            position: 'center',
            combination: 'single',
            rotation: 0,
            decorations: []
        };

        // 扩展颜色关键词
        const colorMap = {
            '红': '#ff4444', '红色': '#ff4444', '深红': '#cc0000', '浅红': '#ff9999',
            '蓝': '#4444ff', '蓝色': '#4444ff', '深蓝': '#0000cc', '浅蓝': '#9999ff',
            '绿': '#44ff44', '绿色': '#44ff44', '深绿': '#00cc00', '浅绿': '#99ff99',
            '黄': '#ffff44', '黄色': '#ffff44', '金色': '#ffd700', '橙色': '#ffa500',
            '紫': '#9b59b6', '紫色': '#9b59b6', '深紫': '#663399', '浅紫': '#cc99ff',
            '黑': '#333333', '黑色': '#333333',
            '白': '#ffffff', '白色': '#ffffff',
            '灰': '#888888', '灰色': '#888888', '深灰': '#444444', '浅灰': '#cccccc',
            '粉': '#ffb6c1', '粉色': '#ffb6c1', '粉红': '#ffb6c1',
            '棕': '#8b4513', '棕色': '#8b4513', '褐色': '#8b4513'
        };

        // 扩展形状关键词
        const shapes = {
            basic: ['圆形', '圆', '正方形', '长方形', '方形', '方块', '三角形', '三角', '星形', '星星', 
                    '心形', '爱心', '六边形', '箭头'],
            complex: ['月亮', '云朵', '闪电', '钥匙', '铃铛', '花朵', '树叶', '太阳'],
            tech: ['齿轮', '扳手', '设置', '电脑', '手机', '信封', '消息']
        };

        // 位置关键词
        const positions = {
            '上': 'top',
            '下': 'bottom',
            '左': 'left',
            '右': 'right',
            '中': 'center',
            '中间': 'center'
        };

        // 组合关键词
        const combinations = {
            '重叠': 'overlap',
            '并排': 'sideBySide',
            '环绕': 'surround',
            '嵌套': 'nested'
        };

        // 装饰关键词
        const decorations = {
            '发光': 'glow',
            '渐变': 'gradient',
            '描边': 'stroke',
            '阴影': 'shadow',
            '点缀': 'dots',
            '虚线': 'dashed'
        };

        // 分析颜色
        Object.keys(colorMap).forEach(color => {
            if (prompt.includes(color)) {
                keywords.colors.push(colorMap[color]);
            }
        });

        // 分析形状
        Object.keys(shapes).forEach(category => {
            shapes[category].forEach(shape => {
                if (prompt.includes(shape)) {
                    // 将正方形的输入转换为方形
                    let shapeType = shape;
                    if (shape === '正方形') {
                        shapeType = '方形';  // 将正方形转换为方形
                    }
                    keywords.shapes.push({
                        type: shapeType,
                        category: category
                    });
                }
            });
        });

        // 分析位置
        Object.keys(positions).forEach(pos => {
            if (prompt.includes(pos)) {
                keywords.position = positions[pos];
            }
        });

        // 分析组合方式
        Object.keys(combinations).forEach(combo => {
            if (prompt.includes(combo)) {
                keywords.combination = combinations[combo];
            }
        });

        // 分析装饰效果
        Object.keys(decorations).forEach(deco => {
            if (prompt.includes(deco)) {
                keywords.decorations.push(decorations[deco]);
            }
        });

        // 分析风格
        if (prompt.includes('简单') || prompt.includes('简约')) {
            keywords.style = 'simple';
        } else if (prompt.includes('复杂') || prompt.includes('详细')) {
            keywords.style = 'complex';
        } else if (prompt.includes('现代') || prompt.includes('科技')) {
            keywords.style = 'modern';
        } else if (prompt.includes('可爱') || prompt.includes('卡通')) {
            keywords.style = 'cute';
        }

        // 分析旋转
        const rotationMatch = prompt.match(/旋转(\d+)度/);
        if (rotationMatch) {
            keywords.rotation = parseInt(rotationMatch[1]);
        }

        // 如果没有指定颜色，根据风格选择默认颜色
        if (keywords.colors.length === 0) {
            switch (keywords.style) {
                case 'modern':
                    keywords.colors = ['#2c3e50'];
                    break;
                case 'cute':
                    keywords.colors = ['#ff69b4'];
                    break;
                default:
                    keywords.colors = ['#3498db'];
            }
        }

        return keywords;
    }

    // 修改图标生成方法
    generateIconSpec(keywords) {
        const iconSpec = {
            backgroundColor: '#ffffff',
            elements: []
        };

        const center = 64;
        const baseSize = keywords.style === 'simple' ? 40 : 50;

        // 如果没有识别到形状，使用默认形状
        if (keywords.shapes.length === 0) {
            keywords.shapes = [{
                type: 'circle',
                category: 'basic'
            }];
        }

        // 修改形状类型映射
        keywords.shapes = keywords.shapes.map(shape => {
            const typeMap = {
                '圆形': 'circle', '圆': 'circle',
                '正方形': 'square', // 改回 square
                '方形': 'square', '方块': 'square',
                '长方形': 'rectangle',
                '三角形': 'triangle', '三角': 'triangle',
                '星形': 'star', '星星': 'star',
                '心形': 'heart', '爱心': 'heart',
                '六边形': 'hexagon',
                '箭头': 'arrow',
            };

            return {
                ...shape,
                type: typeMap[shape.type] || shape.type
            };
        });

        // 处理组合图形
        if (keywords.shapes.length > 1) {
            switch (keywords.combination) {
                case 'overlap':
                    this.generateOverlappingShapes(iconSpec, keywords, center, baseSize);
                    break;
                case 'sideBySide':
                    this.generateSideBySideShapes(iconSpec, keywords, center, baseSize);
                    break;
                case 'surround':
                    this.generateSurroundingShapes(iconSpec, keywords, center, baseSize);
                    break;
                case 'nested':
                    this.generateNestedShapes(iconSpec, keywords, center, baseSize);
                    break;
                default:
                    this.generateDefaultLayout(iconSpec, keywords, center, baseSize);
            }
        } else {
            // 单个图形
            this.generateSingleShape(iconSpec, keywords, center, baseSize);
        }

        // 应用装饰效果
        this.applyDecorations(iconSpec, keywords);

        return iconSpec;
    }

    // 添加新的组合生成方法
    generateOverlappingShapes(iconSpec, keywords, center, baseSize) {
        keywords.shapes.forEach((shape, index) => {
            const offset = index * 10;
            const element = this.createShapeElement(shape.type, center + offset, center + offset, 
                keywords.style, baseSize);
            if (element) {
                element.color = keywords.colors[index % keywords.colors.length];
                element.opacity = 0.7; // 添加透明度实现叠加效果
                iconSpec.elements.push(element);
            }
        });
    }

    generateSideBySideShapes(iconSpec, keywords, center, baseSize) {
        const spacing = baseSize * 0.6;
        const totalWidth = keywords.shapes.length * spacing;
        let startX = center - totalWidth / 2 + spacing / 2;

        keywords.shapes.forEach((shape, index) => {
            const element = this.createShapeElement(shape.type, startX + index * spacing, 
                center, keywords.style, baseSize * 0.8);
            if (element) {
                element.color = keywords.colors[index % keywords.colors.length];
                iconSpec.elements.push(element);
            }
        });
    }

    // 添加装饰效果方法
    applyDecorations(iconSpec, keywords) {
        keywords.decorations.forEach(decoration => {
            switch (decoration) {
                case 'glow':
                    iconSpec.elements.forEach(element => {
                        element.glow = {
                            color: element.color,
                            blur: 10,
                            spread: 5
                        };
                    });
                    break;
                case 'gradient':
                    iconSpec.elements.forEach(element => {
                        element.gradient = {
                            type: 'linear',
                            colors: [element.color, this.lightenColor(element.color, 30)]
                        };
                    });
                    break;
                case 'stroke':
                    iconSpec.elements.forEach(element => {
                        element.stroke = {
                            color: this.darkenColor(element.color, 20),
                            width: 2
                        };
                    });
                    break;
                // 添加更多装饰效果...
            }
        });
    }

    // 修改绘制方法以支持新特性
    async drawAIIcon(description) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = description.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 应用全局旋转
        if (description.rotation) {
            this.ctx.save();
            this.ctx.translate(this.canvas.width/2, this.canvas.height/2);
            this.ctx.rotate(description.rotation * Math.PI / 180);
            this.ctx.translate(-this.canvas.width/2, -this.canvas.height/2);
        }

        // 绘制元素
        for (const element of description.elements) {
            // 应用装饰效果
            if (element.glow) {
                this.ctx.shadowColor = element.glow.color;
                this.ctx.shadowBlur = element.glow.blur;
                this.ctx.shadowOffsetX = 0;
                this.ctx.shadowOffsetY = 0;
            }

            if (element.gradient) {
                const gradient = this.ctx.createLinearGradient(
                    element.x, element.y,
                    element.x + (element.width || element.radius || 0),
                    element.y + (element.height || element.radius || 0)
                );
                gradient.addColorStop(0, element.gradient.colors[0]);
                gradient.addColorStop(1, element.gradient.colors[1]);
                this.ctx.fillStyle = gradient;
            } else {
                this.ctx.fillStyle = element.color;
            }

            // 绘制主体
            this.drawElement(element);

            // 绘制描边
            if (element.stroke) {
                this.ctx.strokeStyle = element.stroke.color;
                this.ctx.lineWidth = element.stroke.width;
                this.ctx.stroke();
            }

            // 重置阴影
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;
        }

        if (description.rotation) {
            this.ctx.restore();
        }
    }

    // 辅助方法
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return `#${(0x1000000 + (R<255?R:255)*0x10000 + (G<255?G:255)*0x100 + (B<255?B:255)).toString(16).slice(1)}`;
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return `#${(0x1000000 + (R>0?R:0)*0x10000 + (G>0?G:0)*0x100 + (B>0?B:0)).toString(16).slice(1)}`;
    }

    // 添加随机生成方法
    async generateRandomIcon() {
        const randomBtn = document.getElementById('randomIcon');
        randomBtn.classList.add('loading');

        try {
            const iconSpec = this.generateRandomIconSpec();
            await this.drawAIIcon(iconSpec);
        } catch (error) {
            console.error('随机生成图标失败:', error);
            alert('生成失败，请重试！');
        } finally {
            randomBtn.classList.remove('loading');
        }
    }

    // 添加随机图标规格生成方法
    generateRandomIconSpec() {
        // 随机颜色生成
        const colors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6', 
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
        ];

        // 随机形状
        const shapes = {
            basic: ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon', 'arrow'],
            complex: ['moon', 'cloud', 'lightning', 'key', 'bell', 'flower', 'leaf', 'sun'],
            tech: ['gear', 'wrench', 'settings', 'computer', 'phone', 'envelope', 'message']
        };

        // 随机装饰效果
        const decorations = ['glow', 'gradient', 'stroke', 'shadow'];

        // 随机组合方式
        const combinations = ['overlap', 'sideBySide', 'surround', 'nested'];

        // 随机选择
        const randomColor = () => colors[Math.floor(Math.random() * colors.length)];
        const randomShape = () => {
            const categories = Object.keys(shapes);
            const category = categories[Math.floor(Math.random() * categories.length)];
            const shapeList = shapes[category];
            return {
                type: shapeList[Math.floor(Math.random() * shapeList.length)],
                category: category
            };
        };

        // 生成随机规格
        const spec = {
            colors: [randomColor(), randomColor()],
            shapes: [randomShape()],
            style: ['simple', 'complex', 'modern', 'cute'][Math.floor(Math.random() * 4)],
            combination: combinations[Math.floor(Math.random() * combinations.length)],
            decorations: [decorations[Math.floor(Math.random() * decorations.length)]]
        };

        // 随机决定是否使用多个形状
        if (Math.random() > 0.5) {
            spec.shapes.push(randomShape());
            if (Math.random() > 0.7) {
                spec.shapes.push(randomShape());
            }
        }

        // 随机旋转
        if (Math.random() > 0.7) {
            spec.rotation = Math.floor(Math.random() * 360);
        }

        return this.generateIconSpec(spec);
    }

    // 添加绘制元素的方法
    drawElement(element) {
        switch (element.type) {
            case 'circle':
                this.drawCircle(element.x, element.y, element.radius);
                break;
            case 'square':
                const halfSize = element.size / 2;
                this.ctx.fillRect(
                    element.x - halfSize,
                    element.y - halfSize,
                    element.size,
                    element.size
                );
                break;
            case 'rectangle':
                this.ctx.fillRect(
                    element.x,
                    element.y,
                    element.width,
                    element.height
                );
                break;
            case 'triangle':
                this.drawPath(element.points);
                break;
            case 'star':
                this.drawPath(this.createStarPoints(element.x, element.y, element.radius));
                break;
            case 'heart':
                this.drawPath(this.createHeartPoints(element.x, element.y, element.size));
                break;
            case 'hexagon':
                this.drawPath(this.createHexagonPoints(element.x, element.y, element.radius));
                break;
            case 'arrow':
                this.drawPath(this.createArrowPoints(element.x, element.y, element.size));
                break;
            // 添加更多形状...
        }
    }

    // 添加单个形状生成方法
    generateSingleShape(iconSpec, keywords, center, baseSize) {
        const shape = keywords.shapes[0];
        let element;

        switch (shape.type) {
            case 'circle':
                element = {
                    type: 'circle',
                    x: center,
                    y: center,
                    radius: baseSize / 2
                };
                break;
            case 'square':
                element = {
                    type: 'square',
                    x: center,
                    y: center,
                    size: baseSize // 只使用一个 size 属性
                };
                break;
            case 'rectangle':
                element = {
                    type: 'rectangle',
                    x: center - baseSize * 0.8,
                    y: center - baseSize * 0.3,
                    width: baseSize * 1.6,
                    height: baseSize * 0.6
                };
                break;
            case 'triangle':
                element = {
                    type: 'triangle',
                    points: [
                        { x: center, y: center - baseSize / 2 },
                        { x: center - baseSize / 2, y: center + baseSize / 2 },
                        { x: center + baseSize / 2, y: center + baseSize / 2 }
                    ]
                };
                break;
            case 'star':
                element = {
                    type: 'star',
                    x: center,
                    y: center,
                    radius: baseSize / 2
                };
                break;
            case 'heart':
                element = {
                    type: 'heart',
                    x: center,
                    y: center,
                    size: baseSize
                };
                break;
            case 'hexagon':
                element = {
                    type: 'hexagon',
                    x: center,
                    y: center,
                    radius: baseSize / 2
                };
                break;
            case 'arrow':
                element = {
                    type: 'arrow',
                    x: center,
                    y: center,
                    size: baseSize
                };
                break;
        }

        if (element) {
            element.color = keywords.colors[0];
            iconSpec.elements.push(element);
        }
    }

    // 添加形状点生成方法
    createStarPoints(cx, cy, radius) {
        const points = [];
        const spikes = 5;
        const innerRadius = radius * 0.4;

        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? radius : innerRadius;
            const angle = (Math.PI / spikes) * i;
            points.push({
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r
            });
        }
        return points;
    }

    createHeartPoints(cx, cy, size) {
        const points = [];
        const scale = size / 30;
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const r = size * (1 - Math.sin(angle));
            points.push({
                x: cx + Math.cos(angle) * r * scale,
                y: cy + Math.sin(angle) * r * scale * 0.8
            });
        }
        return points;
    }

    createHexagonPoints(cx, cy, radius) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            points.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
            });
        }
        return points;
    }

    createArrowPoints(cx, cy, size) {
        return [
            { x: cx - size/2, y: cy },
            { x: cx + size/2, y: cy },
            { x: cx, y: cy - size/2 },
            { x: cx + size/2, y: cy },
            { x: cx, y: cy + size/2 }
        ];
    }

    // 修改 generateDefaultLayout 方法
    generateDefaultLayout(iconSpec, keywords, center, baseSize) {
        const spacing = baseSize * 0.3;
        keywords.shapes.forEach((shape, index) => {
            const element = this.createShapeElement(
                shape.type,
                center + (index - (keywords.shapes.length - 1) / 2) * spacing,
                center,
                keywords.style,
                baseSize * 0.8
            );
            if (element) {
                element.color = keywords.colors[index % keywords.colors.length];
                iconSpec.elements.push(element);
            }
        });
    }

    // 添加形状元素创建方法
    createShapeElement(type, x, y, style, size) {
        const element = {
            type: type,
            x: x,
            y: y,
            color: '#000000'
        };

        switch (type) {
            case 'circle':
                element.radius = size / 2;
                break;
            case 'square':
                element.type = 'square';
                element.size = size;
                element.x = x;
                element.y = y;
                break;
            case 'rectangle':
                element.type = 'rectangle';
                element.width = size * 1.6;
                element.height = size * 0.6;
                element.x -= (size * 1.6) / 2;
                element.y -= size * 0.3;
                break;
            case 'triangle':
                element.points = [
                    { x: x, y: y - size / 2 },
                    { x: x - size / 2, y: y + size / 2 },
                    { x: x + size / 2, y: y + size / 2 }
                ];
                break;
            case 'star':
                element.radius = size / 2;
                break;
            case 'heart':
                element.size = size;
                break;
            case 'hexagon':
                element.radius = size / 2;
                break;
            case 'arrow':
                element.size = size;
                break;
        }

        return element;
    }

    // 添加嵌套形状生成方法
    generateNestedShapes(iconSpec, keywords, center, baseSize) {
        // 从大到小排列形状
        const shapes = [...keywords.shapes].reverse();
        const colors = [...keywords.colors];
        
        shapes.forEach((shape, index) => {
            const scale = 1 - (index * 0.3); // 每层缩小 30%
            const element = this.createShapeElement(
                shape.type,
                center,
                center,
                keywords.style,
                baseSize * scale
            );
            if (element) {
                element.color = colors[index % colors.length];
                iconSpec.elements.push(element);
            }
        });
    }

    // 添加环绕形状生成方法
    generateSurroundingShapes(iconSpec, keywords, center, baseSize) {
        // 第一个形状放在中间
        const mainShape = keywords.shapes[0];
        const mainElement = this.createShapeElement(
            mainShape.type,
            center,
            center,
            keywords.style,
            baseSize
        );
        if (mainElement) {
            mainElement.color = keywords.colors[0];
            iconSpec.elements.push(mainElement);
        }

        // 其余形状环绕在周围
        const surroundingShapes = keywords.shapes.slice(1);
        const radius = baseSize * 0.8;
        const angleStep = (Math.PI * 2) / surroundingShapes.length;

        surroundingShapes.forEach((shape, index) => {
            const angle = angleStep * index;
            const x = center + Math.cos(angle) * radius;
            const y = center + Math.sin(angle) * radius;
            
            const element = this.createShapeElement(
                shape.type,
                x,
                y,
                keywords.style,
                baseSize * 0.4
            );
            if (element) {
                element.color = keywords.colors[(index + 1) % keywords.colors.length];
                iconSpec.elements.push(element);
            }
        });
    }

    // 在 IconGenerator 类中添加 drawPath 方法
    drawPath(points) {
        if (!points || points.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        
        this.ctx.closePath();
        this.ctx.fill();
    }
}

// 初始化图标生成器
window.addEventListener('load', () => {
    new IconGenerator();
}); 