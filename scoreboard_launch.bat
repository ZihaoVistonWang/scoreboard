@echo off
call D:/anaconda3/Scripts/activate
call conda activate web

rem 设置工作目录
cd /d "E:\PythonLib\scoreboard"

rem 获取当前日期并格式化为 YYYY-MM-DD
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (
    set year=%%c
    set month=%%a
    set day=%%b
)
set logdate=%year%-%month%-%day%

rem 使用 start /b /min 启动无窗口的 pythonw 进程，并将 log 文件命名为 log_YYYY-MM-DD.txt
start "" /b /min pythonw "E:\PythonLib\scoreboard\app.py" >> "E:\PythonLib\scoreboard\log\log_%logdate%.txt"

echo 记分牌脚本已启动！
echo The script of scoreboard has been started!

set countdown=5
:countdown_loop
if %countdown% gtr 0 (
    cls
    echo 记分牌脚本已启动！
    echo The script of scoreboard has been started!
    echo 关闭窗口倒计时：%countdown% 秒
    timeout /t 1 >nul
    set /a countdown=%countdown%-1
    goto countdown_loop
)

exit
