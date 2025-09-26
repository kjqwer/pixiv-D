@echo off
chcp 65001 >nul
echo.
echo ========================================
echo 🔍 Pixiv Manager 环境检测
echo ========================================
echo.

cd /d "%~dp0"

echo 📂 当前目录: %CD%
echo.

:: 检查 Node.js
echo 🔍 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Node.js
    echo 📥 请先安装 Node.js: https://nodejs.org/
    goto :end
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js: %%i
)

:: 检查 package.json
echo.
echo 🔍 检查项目文件...
if not exist "package.json" (
    echo ❌ 未找到 package.json
    goto :end
) else (
    echo ✅ package.json 存在
)

:: 检查 node_modules
if not exist "node_modules" (
    echo ⚠️  node_modules 不存在，需要安装依赖
    set /p choice="是否现在安装依赖? (y/n): "
    if /i "%choice%"=="y" (
        echo 📦 安装依赖包...
        npm install
        if errorlevel 1 (
            echo ❌ 依赖安装失败
            goto :end
        ) else (
            echo ✅ 依赖安装成功
        )
    )
) else (
    echo ✅ node_modules 存在
)

:: 检查前端项目文件
echo.
echo 🔍 检查前端项目文件...
if not exist "ui/package.json" (
    echo ❌ 未找到 ui/package.json
    echo 📁 前端项目文件不存在
    goto :end
) else (
    echo ✅ ui/package.json 存在
)

:: 检查前端依赖
if not exist "ui/node_modules" (
    set /p choice="前端依赖不存在，是否现在安装前端依赖? (y/n): "
    if /i "%choice%"=="y" (
        echo 📦 安装前端依赖包...
        cd ui
        npm install
        cd ..
        if errorlevel 1 (
            echo ❌ 前端依赖安装失败
            goto :end
        ) else (
            echo ✅ 前端依赖安装成功
        )
    )
) else (
    echo ✅ ui/node_modules 存在
)

:: 检查前端构建文件
echo.
echo 🔍 检查前端构建文件...
if not exist "ui/dist" (
    echo ⚠️  ui/dist 不存在，需要构建前端
    set /p choice="是否现在构建前端? (y/n): "
    if /i "%choice%"=="y" (
        echo 📦 构建前端文件...
        cd ui
        npm run build
        cd ..
        if errorlevel 1 (
            echo ❌ 前端构建失败
            goto :end
        ) else (
            echo ✅ 前端构建成功
        )
    )
) else (
    echo ✅ ui/dist 存在
)

echo.
echo ========================================
echo ✅ 环境检测完成，可以启动应用
echo ========================================

:end
echo.
pause 