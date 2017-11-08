process.on('uncaughtException', (msg) => {
	console.log(`进程异常,异常信息为:${msg}`);
});

var express = require('express');
var bodyParser = require('body-parser');
var fs = require("fs");
var multer  = require('multer');
var util = require('util');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var ws = require('nodejs-websocket');
var archiver = require('archiver');

// 创建 application/x-www-form-urlencoded 编码解析
var urlencodedParser = bodyParser.urlencoded({ extended: false });

//websocket配置
var wsServer = ws.createServer(function(conn){
	conn.on("text", function (str) {
        console.log("websocket 收到的信息为:"+str);
        conn.sendText('Hello');
    })
    conn.on("close", function(code, reason) {
        console.log("websocket 关闭连接")
    });
    conn.on("error", function(code, reason) {
        console.log("websocket 异常关闭")
    });
}).listen(9889)

var app = express();

//静态资源配置
app.use(express.static('public'));

//session配置
app.use(cookieParser('session'));
app.use(session({
    secret: 'session',//与cookieParser中的一致
    resave: true,
    saveUninitialized:true
}));

//配置服务
var server = app.listen(9888, () => {
	var host = server.address().address;
  	var port = server.address().port;
  	
  	console.log("应用实例，访问地址为 http://%s:%s", host, port);
})

//拦截器，拦截未登录直接访问页面的非法请求
app.all('/*', (req, res, next) => {
	if(req.url != '/' && req.url != '/login' && (req.session.user == undefined || req.session.user == null)){
		res.sendFile(__dirname + '/public/view/illegal.html');
	}else{
		next();
	}
})

//路由
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/public/view/login.html');
}).post('/login', urlencodedParser, (req, res) => {					//登录
	var user = {
		username: req.body.username,
		password: req.body.password,
		isRemember: req.body.isRemember
	}
	
	if(user.username == 'ggc'){
		if(user.password == '123456'){
			if(user.isRemember == 'on'){
				res.cookie('username', user.username, {maxAge: 7 * 24 * 3600 * 1000});	//写入用户名cookie
				res.cookie('password', user.password, {maxAge: 7 * 24 * 3600 * 1000});	//写入密码cookie
			}
			
			req.session.user = user;
			console.log('登录成功,登录参数:', user);
			res.status(200).json({
				status: 1,
			});
		}else{
			console.log('登录失败[密码错误],登录参数:', user);
			res.status(200).json({
				status: 0,
				desc: `用户 ${user.username} 密码错误`
			});
		}
	}else{
		console.log('登录失败[用户不存在],登录参数:', user);
		res.status(200).json({
			status: 0,
			desc: `用户 ${user.username} 不存在`
		});
	}
}).get('/home', (req, res) => {										//主页
	res.sendFile(__dirname + '/public/view/home.html');
}).post('/initHome', (req, res) => {								//初始化主页
	var fileList = [];
	var fileNames = fs.readdirSync('/');
	fileNames.forEach(function(value, index){
		var fileStat = fs.statSync('/' + value);
		fileList.push({
			fileName: value,
			fileType: fileStat.isFile() ? '1' : '2',
			fileCreateDate: formatTDate(fileStat.birthtime),
			fileUpdateDate: formatTDate(fileStat.atime),
		})
	})
	res.status(200).json({
		status: 1,
		loginUsername: req.session.user.username,
		fileList: fileList
	});
}).post('/loginOut', (req, res) => {								//退出登录
	console.log('用户退出登录：', req.session.user);
	delete req.session.user;
	res.status(200).json({
		status: 1,
	});
}).post('/loadFileList', urlencodedParser, (req, res) => {			//根据路径获取文件列表及文件信息
	var filePath = req.body.filePath;
	var fileList = [];
	var fileNames = fs.readdirSync(filePath);
	fileNames.forEach(function(fileName, index){
		var fileStat = fs.statSync(filePath + '/' + fileName);
		fileList.push({
			fileName: fileName,
			fileType: fileStat.isFile() ? '1' : '2',
			fileCreateDate: formatTDate(fileStat.birthtime),
			fileUpdateDate: formatTDate(fileStat.atime),
		})
	})
	res.status(200).json({
		status: 1,
		fileList: fileList
	});
}).post('/downloadFile', urlencodedParser, (req, res) => {			//删除文件/文件夹
	var filePath = req.body.filePath;
	var fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
	console.log(`用户:${req.session.user.username} 请求下载文件-----------${filePath}`);
	var stats = fs.stat(filePath, function(err, stats){
		if(err){
			console.log(err);
		}else{
			if(stats.isFile()){	//单一文件直接下载
				res.download(filePath,fileName, function(err){
					if(err){
						console.log(err);
						res.end();
					}else{
						console.log(`用户:${req.session.user.username} 文件------------------${filePath} 已被下载`);
						res.end();
					}
				});
			}else{	//文件夹先打包成zip再提供下载
				var archive = archiver('zip');
 				var output = fs.createWriteStream('tmp/' + fileName + '.zip');
		        archive.pipe(output);
		        archive.directory(filePath, fileName);
		        archive.finalize();
		        output.on('close', function() {
					console.log(filePath + '文件压缩完成');
					res.download('tmp/' + fileName + '.zip',fileName + '.zip', function(err){
						if(err){
							console.log(err);
							res.end();
						}else{
							console.log(`用户:${req.session.user.username} 文件------------------${filePath} 已被下载`);
							res.end();
						}
					});
				});
			}
		}
		
	});
	
}).post('/deleteFile', urlencodedParser, (req, res) => {			//删除文件/文件夹
	var filePath = req.body.filePath;
	console.log(`用户:${req.session.user.username} 即将删除文件-----------${filePath}`);
	deleteFileOrDir(filePath);
	console.log(`用户: ${req.session.user.username} 文件------------------${filePath} 已被删除`);
	res.status(200).json({
		status: 1,
	});
})

//工具函数-格式化T日期
function formatTDate(tDateStr){
	var formatDateStr = new Date(tDateStr).toJSON();  
	return new Date(+new Date(formatDateStr)+8*3600*1000).toISOString().replace(/T/g,' ').replace(/\.[\d]{3}Z/,''); 
}

//递归删除文件/文件夹
function deleteFileOrDir(filePath){
	var stats = fs.statSync(filePath);
	//是单一文件直接删除
	if(stats.isFile()){					
		fs.unlinkSync(filePath);
		return;
	}
	//是文件夹调用递归删除函数
	emptyFile(filePath);
	deleteEmptyFile(filePath);
}
function emptyFile(filePath){
	var fileNames = fs.readdirSync(filePath);
	fileNames.forEach(function(fileName, index){
		var fileStat = fs.statSync(filePath + '/' + fileName);
		if(fileStat.isFile()){					//是文件直接删除
			fs.unlinkSync(filePath + '/' + fileName);
			return;
		}else{									//非空文件夹递归删除
			emptyFile(filePath + '/' + fileName);
		}
	})
}

function deleteEmptyFile(filePath){
	var fileNames = fs.readdirSync(filePath);
	var leftFileCount = fileNames.length;
	if(fileNames.length > 0){
		fileNames.forEach(function(fileName, index){
			deleteEmptyFile(filePath + '/' + fileName);
		})
		fs.rmdirSync(filePath);
	}else{
		fs.rmdirSync(filePath);
	}
}

