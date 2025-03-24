/**
 * 图表管理相关功能
 */

// 图表相关全局变量
let chartInstances = [];

// 确保Chart.js和插件被正确加载
function ensureChartLibraries() {
    return new Promise((resolve, reject) => {
        // 检查Chart.js库和插件是否已加载
        if (typeof Chart === 'undefined') {
            console.log('Loading Chart.js library...');
            const chartScript = document.createElement('script');
            chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js';
            chartScript.crossOrigin = 'anonymous';
            
            document.head.appendChild(chartScript);
            
            chartScript.onload = function() {
                console.log('Chart.js dynamically loaded');
                // 给Chart.js充分时间初始化
                setTimeout(() => {
                    // 确认Chart全局对象已存在
                    if (typeof Chart === 'undefined') {
                        reject('Chart.js loaded but Chart object is not available');
                        return;
                    }
                    
                    // 加载annotation插件
                    loadAnnotationPlugin(resolve, reject);
                }, 300); // 增加延迟给予Chart.js更多初始化时间
            };
            
            chartScript.onerror = function(e) {
                console.error('Failed to load Chart.js', e);
                // 尝试使用备用CDN
                const fallbackScript = document.createElement('script');
                fallbackScript.src = 'https://unpkg.com/chart.js@3.7.1/dist/chart.min.js';
                document.head.appendChild(fallbackScript);
                
                fallbackScript.onload = function() {
                    console.log('Chart.js loaded from fallback CDN');
                    // 给Chart.js充分时间初始化
                    setTimeout(() => {
                        // 确认Chart全局对象已存在
                        if (typeof Chart === 'undefined') {
                            reject('Chart.js loaded from fallback but Chart object is not available');
                            return;
                        }
                        
                        // 加载annotation插件
                        loadAnnotationPlugin(resolve, reject);
                    }, 300);
                };
                
                fallbackScript.onerror = function() {
                    reject('Failed to load Chart.js from all sources');
                };
            };
        } else if (typeof ChartAnnotation === 'undefined') {
            console.log('Loading Chart.js annotation plugin...');
            loadAnnotationPlugin(resolve, reject);
        } else {
            // 两者都已加载，注册插件
            console.log('Both Chart.js and Annotation plugin loaded');
            tryRegisterAnnotation(resolve, reject);
        }
    });
}

// 提取加载annotation插件的逻辑到单独函数
function loadAnnotationPlugin(resolve, reject) {
    const annotationScript = document.createElement('script');
    annotationScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@1.4.0/dist/chartjs-plugin-annotation.min.js';
    annotationScript.crossOrigin = 'anonymous';
    document.head.appendChild(annotationScript);
    
    annotationScript.onload = function() {
        console.log('Annotation plugin dynamically loaded');
        // 给插件充分时间初始化
        setTimeout(() => {
            tryRegisterAnnotation(resolve, reject);
        }, 300);
    };
    
    annotationScript.onerror = function() {
        console.error('Failed to load annotation plugin from primary source');
        // 尝试使用备用CDN
        const fallbackScript = document.createElement('script');
        fallbackScript.src = 'https://unpkg.com/chartjs-plugin-annotation@1.4.0/dist/chartjs-plugin-annotation.min.js';
        document.head.appendChild(fallbackScript);
        
        fallbackScript.onload = function() {
            console.log('Annotation plugin loaded from fallback CDN');
            // 给插件充分时间初始化
            setTimeout(() => {
                tryRegisterAnnotation(resolve, reject);
            }, 300);
        };
        
        fallbackScript.onerror = function() {
            // 最后尝试使用第三个备用源
            const thirdFallbackScript = document.createElement('script');
            thirdFallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/1.4.0/chartjs-plugin-annotation.min.js';
            document.head.appendChild(thirdFallbackScript);
            
            thirdFallbackScript.onload = function() {
                console.log('Annotation plugin loaded from third fallback CDN');
                setTimeout(() => {
                    tryRegisterAnnotation(resolve, reject);
                }, 300);
            };
            
            thirdFallbackScript.onerror = function() {
                reject('Failed to load annotation plugin from all sources');
            };
        };
    };
}

// 尝试注册ChartAnnotation插件到Chart对象
function tryRegisterAnnotation(resolve, reject) {
    // 确保两个对象都存在
    if (typeof Chart === 'undefined') {
        reject('Chart object not available');
        return;
    }
    
    // 检查ChartAnnotation对象是否可用
    // 注意：有些CDN可能使用不同的全局变量名
    const annotationPlugin = window.ChartAnnotation || 
                             window.chartjs_plugin_annotation || 
                             window._chartjs_annotation;
    
    if (!annotationPlugin) {
        console.warn('ChartAnnotation global object not found, trying alternate approach');
        
        // 尝试使用Chart.register方法但不指定插件，有些版本会自动注册
        try {
            // 检查是否已注册
            if (Chart.registry && Chart.registry.plugins && 
                Chart.registry.plugins.items && 
                Chart.registry.plugins.items.annotation) {
                console.log('Annotation plugin already registered');
                resolve();
                return;
            }
            
            // 尝试注册没有全局变量的情况
            Chart.register();
            console.log('Chart.register called without plugin parameter');
            
            // 检查是否注册成功
            if (Chart.registry && Chart.registry.plugins && 
                Chart.registry.plugins.items && 
                Chart.registry.plugins.items.annotation) {
                console.log('Annotation plugin successfully registered');
                resolve();
                return;
            }
            
            // 如果上述方法失败，尝试添加一个基本的注解插件来代替
            // 这是一个后备方案，提供基本功能
            const basicAnnotationPlugin = {
                id: 'annotation',
                afterDraw: function(chart) {
                    const annotations = chart.options.plugins.annotation?.annotations || {};
                    
                    // 绘制线条
                    for (const key in annotations) {
                        const annotation = annotations[key];
                        if (annotation.type === 'line') {
                            const ctx = chart.ctx;
                            const scale = chart.scales[annotation.scaleID];
                            
                            if (!scale) continue;
                            
                            // 保存状态
                            ctx.save();
                            
                            // 设置样式
                            ctx.strokeStyle = annotation.borderColor || 'red';
                            ctx.lineWidth = annotation.borderWidth || 1;
                            if (annotation.borderDash) {
                                ctx.setLineDash(annotation.borderDash);
                            }
                            
                            // 绘制线条
                            const y = scale.getPixelForValue(annotation.yMin);
                            ctx.beginPath();
                            ctx.moveTo(chart.chartArea.left, y);
                            ctx.lineTo(chart.chartArea.right, y);
                            ctx.stroke();
                            
                            // 绘制标签
                            if (annotation.label && annotation.label.enabled) {
                                ctx.fillStyle = annotation.label.backgroundColor || 'rgba(255, 0, 0, 0.1)';
                                ctx.textAlign = 'left';
                                ctx.textBaseline = 'middle';
                                ctx.font = '10px Arial';
                                ctx.fillStyle = annotation.label.color || 'red';
                                ctx.fillText(annotation.label.content, 
                                            chart.chartArea.left + 10, y);
                            }
                            
                            // 恢复状态
                            ctx.restore();
                        }
                    }
                }
            };
            
            // 注册我们的基本实现
            Chart.register(basicAnnotationPlugin);
            console.log('Registered basic annotation plugin fallback');
            resolve();
        } catch (e) {
            console.error('Error in annotation registration fallback:', e);
            reject('Failed to register annotation plugin: ' + e.message);
        }
    } else {
        // 使用找到的插件对象
        try {
            Chart.register(annotationPlugin);
            console.log('Annotation plugin successfully registered');
            resolve();
        } catch (e) {
            console.error('Error registering annotation plugin:', e);
            reject('Failed to register annotation plugin: ' + e.message);
        }
    }
}

// 初始化积分图功能
function initScoreCharts(roomId, currentUserId) {
    const showChartBtn = document.getElementById('show-chart');
    const scoreChartSection = document.getElementById('score-chart-section');
    const scoreCharts = document.getElementById('score-charts');
    
    // 不存在则不初始化
    if (!showChartBtn || !scoreChartSection || !scoreCharts) {
        return;
    }
    
    // 点击"积分变化图"按钮
    showChartBtn.addEventListener('click', function() {
        if (scoreChartSection.style.display === 'none') {
            // 先关闭日志区域
            const userLogsSection = document.getElementById('user-logs-section');
            const showLogsBtn = document.getElementById('show-logs');
            
            if (userLogsSection && userLogsSection.style.display !== 'none' && showLogsBtn) {
                userLogsSection.style.display = 'none';
                showLogsBtn.textContent = '本局记录';
                showLogsBtn.classList.remove('active');
            }
            
            // 显示积分图区域
            scoreChartSection.style.display = 'block';
            showChartBtn.textContent = '关闭积分图';
            showChartBtn.classList.add('active');
            
            // 显示加载提示
            scoreCharts.innerHTML = '<p>正在加载图表，请稍候...</p>';
            
            // 如果之前尝试加载失败过，使用更友好的提示
            if (window.chartLoadingState && window.chartLoadingState.loadingFailed) {
                scoreCharts.innerHTML = '<p>正在重新加载图表...</p>';
                
                // 如果失败次数过多，显示特殊提示
                if (window.chartLoadingState.retryCount > 2) {
                    scoreCharts.innerHTML = `
                        <p>图表加载困难，可能是网络问题或浏览器兼容性问题。</p>
                        <p>您可以尝试以下方法：</p>
                        <ul style="padding-left: 20px; margin-top: 10px;">
                            <li>刷新页面后重试</li>
                            <li>使用Chrome或Firefox浏览器</li>
                            <li>检查您的网络连接</li>
                        </ul>
                        <button id="retry-chart-load" class="btn" style="margin-top: 10px;">重试加载</button>
                    `;
                    
                    // 添加重试按钮事件
                    const retryBtn = document.getElementById('retry-chart-load');
                    if (retryBtn) {
                        retryBtn.addEventListener('click', function() {
                            scoreCharts.innerHTML = '<p>正在重新加载图表...</p>';
                            loadChartData();
                        });
                    }
                    return;
                }
            }
            
            // 标记正在加载
            if (window.chartLoadingState) {
                window.chartLoadingState.loadingStarted = true;
            }
            
            // 加载图表数据
            loadChartData();
        } else {
            // 关闭积分图
            closeScoreCharts();
        }
    });
    
    // 封装加载图表的逻辑
    function loadChartData() {
        // 确保Chart.js库已加载，然后获取数据
        ensureChartLibraries()
            .then(() => fetchUserScores(roomId, currentUserId))
            .catch(error => {
                console.error('Error initializing charts:', error);
                
                // 标记加载失败
                if (window.chartLoadingState) {
                    window.chartLoadingState.loadingFailed = true;
                    window.chartLoadingState.retryCount++;
                }
                
                // 显示友好的错误消息
                scoreCharts.innerHTML = `
                    <p>加载图表库失败，请刷新页面重试。</p>
                    <p style="color: #888; font-size: 12px;">错误详情: ${error}</p>
                    <button id="retry-chart-load" class="btn" style="margin-top: 10px;">重试加载</button>
                `;
                
                // 添加重试按钮
                const retryBtn = document.getElementById('retry-chart-load');
                if (retryBtn) {
                    retryBtn.addEventListener('click', function() {
                        scoreCharts.innerHTML = '<p>正在重新加载图表...</p>';
                        loadChartData();
                    });
                }
            });
    }
}

// 关闭积分图
function closeScoreCharts() {
    const scoreChartSection = document.getElementById('score-chart-section');
    const showChartBtn = document.getElementById('show-chart');
    
    if (scoreChartSection && showChartBtn) {
        scoreChartSection.style.display = 'none';
        showChartBtn.textContent = '积分变化图';
        showChartBtn.classList.remove('active');
        
        // 销毁所有图表实例
        chartInstances.forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        chartInstances.length = 0;
    }
}

// 获取用户积分数据
function fetchUserScores(roomId, currentUserId) {
    const scoreCharts = document.getElementById('score-charts');
    if (!scoreCharts) return;
    
    console.log('Fetching user scores for room:', roomId, 'user:', currentUserId);
    
    // 清空图表区域
    scoreCharts.innerHTML = '<p>正在获取积分数据...</p>';
    
    // 设置请求超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
    
    // 直接获取真实数据
    fetch(`/get_user_scores/${roomId}/${currentUserId}`, {
        signal: controller.signal
    })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // 标记加载成功
                if (window.chartLoadingState) {
                    window.chartLoadingState.loadingFailed = false;
                    window.chartLoadingState.retryCount = 0;
                }
                
                displayUserScores(data.scores, data.initial_score);
                
                // 如果是房主，添加提示
                if (data.is_owner) {
                    const ownerNote = document.createElement('div');
                    ownerNote.className = 'owner-note';
                    ownerNote.innerHTML = '<em>注：作为房主，您可以查看所有玩家的积分变化</em>';
                    ownerNote.style.fontSize = '80%';
                    ownerNote.style.marginTop = '10px';
                    ownerNote.style.color = '#666';
                    scoreCharts.appendChild(ownerNote);
                }
            } else {
                scoreCharts.innerHTML = `<p>暂无积分数据${data.message ? ': ' + data.message : ''}</p>`;
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error fetching user scores:', error);
            
            let errorMessage = '获取积分数据时出错';
            
            // 处理不同类型的错误
            if (error.name === 'AbortError') {
                errorMessage = '获取数据超时，请检查您的网络连接并重试';
            } else if (error.message) {
                errorMessage += `: ${error.message}`;
            }
            
            scoreCharts.innerHTML = `
                <p>${errorMessage}</p>
                <button id="retry-score-fetch" class="btn" style="margin-top: 10px;">重新获取数据</button>
            `;
            
            // 添加重试按钮
            const retryBtn = document.getElementById('retry-score-fetch');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    fetchUserScores(roomId, currentUserId);
                });
            }
        });
}

// 显示用户积分图
function displayUserScores(scores, initialScore) {
    const scoreCharts = document.getElementById('score-charts');
    if (!scoreCharts) return;
    
    try {
        scoreCharts.innerHTML = '';
        
        if (!scores || Object.keys(scores).length === 0) {
            scoreCharts.innerHTML = '<p>暂无积分数据</p>';
            return;
        }
        
        // 为每个用户创建一个图表
        Object.keys(scores).forEach(userName => {
            try {
                const userScoreData = scores[userName];
                
                if (!Array.isArray(userScoreData) || userScoreData.length === 0) {
                    return; // 跳过没有数据的用户
                }
                
                // 创建用户标题
                const userTitle = document.createElement('div');
                userTitle.className = 'user-chart-title';
                userTitle.innerHTML = `<strong>${userName}的积分变化</strong>`;
                scoreCharts.appendChild(userTitle);
                
                // 创建画布
                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'chart-container';
                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);
                scoreCharts.appendChild(canvasContainer);
                
                // 添加刻度注释说明
                const chartNote = document.createElement('div');
                chartNote.className = 'chart-note';
                chartNote.style.fontSize = '12px';
                chartNote.style.color = '#666';
                chartNote.style.marginTop = '5px';
                chartNote.style.marginBottom = '15px';
                chartNote.innerHTML = '<em>注: x轴标记格式为"轮-局"，例如1-0表示第1轮初始积分，2-3表示第2轮第3局</em>';
                scoreCharts.appendChild(chartNote);
                
                // 数据准备
                const allPoints = [];
                const allLabels = [];
                let lastScore = initialScore;
                
                // 每轮的分界点（用于绘制垂直分隔线）
                const roundBoundaries = [0]; // 起始点
                
                // 处理所有轮次数据，横向连接
                userScoreData.forEach((roundScores, roundIndex) => {
                    if (!Array.isArray(roundScores) || roundScores.length === 0) {
                        if (roundIndex === 0) {
                            // 如果第一轮没有数据，添加初始分数
                            allPoints.push(initialScore);
                            allLabels.push(`1-0`);
                        }
                        return; // 跳过空轮次
                    }
                    
                    // 添加每轮第一个点（如果是第一轮，使用initialScore，否则使用上一轮的最后一个分数）
                    if (roundIndex === 0) {
                        allPoints.push(initialScore);
                        allLabels.push(`1-0`);
                    }
                    
                    // 添加本轮所有积分
                    roundScores.forEach((score, i) => {
                        allPoints.push(score);
                        allLabels.push(`${roundIndex + 1}-${i + 1}`);
                        lastScore = score;
                    });
                    
                    // 记录轮次边界
                    roundBoundaries.push(allPoints.length - 1);
                });
                
                // 如果没有有效数据，显示消息
                if (allPoints.length <= 1) {
                    const noDataMsg = document.createElement('p');
                    noDataMsg.textContent = `${userName}暂无积分变化数据`;
                    scoreCharts.appendChild(noDataMsg);
                    return;
                }
                
                // 创建图表
                try {
                    createChart(canvas, userName, allPoints, allLabels, initialScore);
                } catch (chartError) {
                    console.error(`Error creating chart for ${userName}:`, chartError);
                    const errorMsg = document.createElement('p');
                    errorMsg.style.color = '#c12c1f';
                    errorMsg.textContent = `创建${userName}的积分图失败: ${chartError.message}`;
                    scoreCharts.appendChild(errorMsg);
                }
            } catch (userError) {
                console.error(`Error processing user ${userName}:`, userError);
                const errorMsg = document.createElement('p');
                errorMsg.style.color = '#c12c1f';
                errorMsg.textContent = `处理${userName}的数据时出错`;
                scoreCharts.appendChild(errorMsg);
            }
        });
    } catch (error) {
        console.error('Error displaying user scores:', error);
        scoreCharts.innerHTML = `<p>显示积分图时出错: ${error.message}</p>`;
    }
}

// 创建图表的辅助函数
function createChart(canvas, userName, allPoints, allLabels, initialScore) {
    // 创建数据集
    const datasets = [
        {
            label: `${userName}的积分`,
            data: allPoints,
            borderColor: function(context) {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                
                if (!chartArea) {
                    // 如果图表区域未定义，返回默认颜色
                    return '#3271ae';
                }
                
                // 创建渐变色，根据积分高低变化颜色 (红->绿->蓝)
                const gradientBorder = ctx.createLinearGradient(0, chartArea.bottom, 0, 0);
                gradientBorder.addColorStop(0, '#c12c1f'); // 最低积分为红色（亏损）
                gradientBorder.addColorStop(0.5, '#00c853'); // 中间积分为绿色（持平）
                gradientBorder.addColorStop(1, '#3271ae'); // 最高积分为蓝色（盈利）
                
                return gradientBorder;
            },
            backgroundColor: function(context) {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                
                if (!chartArea) {
                    // 如果图表区域未定义，返回默认填充色
                    return 'rgba(50, 113, 174, 0.1)';
                }
                
                // 创建渐变填充
                const gradientFill = ctx.createLinearGradient(0, chartArea.bottom, 0, 0);
                gradientFill.addColorStop(0, 'rgba(193, 44, 31, 0.1)'); // 底部红色半透明（亏损）
                gradientFill.addColorStop(0.5, 'rgba(0, 200, 83, 0.1)'); // 中间绿色半透明（持平）
                gradientFill.addColorStop(1, 'rgba(50, 113, 174, 0.1)'); // 顶部蓝色半透明（盈利）
                
                return gradientFill;
            },
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: function(context) {
                // 根据积分与初始积分的关系确定点的颜色
                const score = context.raw;
                if (score > initialScore) {
                    return '#3271ae'; // 盈利为蓝色
                } else if (score < initialScore) {
                    return '#c12c1f'; // 亏损为红色
                }
                return '#00c853'; // 持平为绿色
            },
            tension: 0.1, // 轻微平滑曲线
            fill: true
        }
    ];
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            font: {
                family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '积分',
                        font: {
                            family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                        }
                    },
                    ticks: {
                        font: {
                            family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                        },
                        // 移动端上减少标签数量
                        maxTicksLimit: window.innerWidth < 768 ? 5 : 10
                    },
                    grid: {
                        color: function(context) {
                            if (context.tick.value === initialScore) {
                                return 'rgba(255, 0, 0, 0.2)'; // 初始分数线用红色
                            }
                            return 'rgba(0, 0, 0, 0.1)';
                        },
                        lineWidth: function(context) {
                            if (context.tick.value === initialScore) {
                                return 2; // 初始分数线加粗
                            }
                            return 1;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '局数',
                        font: {
                            family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                        }
                    },
                    ticks: {
                        font: {
                            family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                        },
                        // 移动端上减少标签数量
                        maxTicksLimit: window.innerWidth < 768 ? 6 : 10,
                        maxRotation: window.innerWidth < 768 ? 0 : 0, // 小屏幕上不旋转标签
                        autoSkip: true
                    }
                }
            },
            // 优化内边距，移动端上减少内边距
            layout: {
                padding: {
                    top: 10,
                    right: window.innerWidth < 768 ? 5 : 10,
                    bottom: 10,
                    left: window.innerWidth < 768 ? 5 : 10
                }
            },
            plugins: {
                title: {
                    display: false, // 不显示标题
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    bodyFont: {
                        family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                    },
                    titleFont: {
                        family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                    },
                    callbacks: {
                        afterLabel: function(context) {
                            const score = context.raw;
                            const diff = score - initialScore;
                            if (diff > 0) {
                                return `盈利: +${diff}`;
                            } else if (diff < 0) {
                                return `亏损: ${diff}`;
                            }
                            return '持平';
                        }
                    }
                },
                legend: {
                    display: false // 不显示图例
                },
                annotation: {
                    annotations: {
                        // 在初始分数位置绘制水平线
                        initialLine: {
                            type: 'line',
                            scaleID: 'y',
                            yMin: initialScore,
                            yMax: initialScore,
                            borderColor: 'rgba(255, 0, 0, 0.5)',
                            borderWidth: 1,
                            borderDash: [6, 6],
                            label: {
                                content: `初始分数 (${initialScore})`,
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                color: 'red',
                                font: {
                                    size: 10,
                                    family: 'Georgia, "helvetica neue", Arial, STZhongsong, "noto serif sc", "microsoft yahei", "pingfang sc", sans-serif'
                                }
                            }
                        }
                        // 移除轮次分界线标签
                    }
                }
            }
        }
    });
    
    // 保存图表实例，以便后续清理
    chartInstances.push(chart);
    
    return chart;
}

// 导出函数
window.ChartManager = {
    initScoreCharts,
    fetchUserScores,
    closeScoreCharts
}; 