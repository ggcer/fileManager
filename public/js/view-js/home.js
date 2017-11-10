var app = new Vue({
	el:'#app',
	data: {
		nowAddress: [{
			desc: '根目录',
			truePath: '',
		}],
		loginUsername: '',
		fileList: [
		
		],
		talkMsg: '',
		talkMsgList: [
		
		],
		downLoadProgress: 80,
	},
	methods: {
		loginOut: function(){
			$.confirm({
				title: '提示',
			    content: '是否立即退出登录',
			    autoClose: 'ok|6000',
			    buttons: {
                    ok: {
                        text: "立即退出",
                        keys: ['enter'],
                        btnClass: 'btn-blue',
                        action: () => {
                        	$.ajax({
								url: '/loginOut',
								method: 'post',
								dataType: 'json',
								cache: false,
								success: (data) => {
									console.log(data);
									if(data.status == 1){
										console.log(`用户 ${this.loginUsername} 退出登录`);
										window.location.href = '/';
									}else{
										$.alert({
										    title: '退出登录失败',
										    content: data.desc,
										});
									}
								},
								error: (jqXHR, textStatus, errorThrown) => {
									$.alert({
									    title: '出错啦',
									    content: `服务器内部错误：${textStatus}`,
									});
								}
							});
                        }
                    },
                    
					cancel: {
						text: "等会吧",
						keys: ['ESC'],
					}
	           	},
			});
		},
		changePath: function(index){
			this.nowAddress = this.nowAddress.slice(0, index + 1);
			this.loadFileList();
		},
		intoFile: function(fileName, fileType){
			if(fileType == 1){
				return false;
			}
			this.nowAddress.push({
				desc: fileName,
				truePath: fileName
			});
			this.loadFileList();
		},
		getNowFilePath: function(){
			var filePath = '';
			this.nowAddress.forEach(function(value, index){
				if(index == 1){
					filePath += value.truePath;
				}else{
					filePath += '/' + value.truePath;
				}
			});
			return filePath;
		},
		loadFileList: function(){
			var filePath = this.getNowFilePath();
			console.log(filePath);
			$.ajax({
				url: '/loadFileList',
				method: 'post',
				dataType: 'json',
				cache: false,
				data: {'filePath': filePath},
				success: (data) => {
					console.log(data);
					if(data.status == 1){
						this.fileList = data.fileList;
						$('body').getNiceScroll(0).doScrollTop(0);
					}else{
						comfirmWithSureBtn('进入文件失败', data.desc);
					}
				},
				error: (jqXHR, textStatus, errorThrown) => {
					comfirmWithSureBtn('出错啦', `服务器内部错误：${textStatus}`);
				}
			});
		},
		downloadFile: function(fileName){
			var filePath = this.getNowFilePath();
			if(filePath != '/'){
				filePath += '/' + fileName;
			}else{
				filePath += fileName;
			}
			
			console.log(filePath);
			downloadFileByForm(filePath);
		},
		deleteFile: function(fileName, index){
			$.confirm({
				title: '提示',
			    content: `是否删除  ${fileName}`,
			    autoClose: 'ok|10000',
			    buttons: {
                    ok: {
                        text: "狠心删除",
                        keys: ['enter'],
                        btnClass: 'btn-red',
                        action: () => {
                        	var filePath = this.getNowFilePath();
							if(filePath != '/'){
								filePath += '/' + fileName;
							}else{
								filePath += fileName;
							}
							
							console.log(filePath);
							$.ajax({
								url: '/deleteFile',
								method: 'post',
								dataType: 'json',
								cache: false,
								data: {'filePath': filePath},
								success: (data) => {
									console.log(data);
									if(data.status == 1){
										this.fileList.splice(index,1);
										comfirmWithSureBtn('文件删除成功', `文件 ${fileName} 已删除(可在垃圾箱中找回)`);
									}else{
										comfirmWithSureBtn('删除文件失败', data.desc);
									}
								},
								error: (jqXHR, textStatus, errorThrown) => {
									comfirmWithSureBtn('出错啦', `服务器内部错误：${textStatus}`);
								}
							});
                        }
                    },
                    
					cancel: {
						text: "按错了",
						keys: ['ESC'],
					}
	           	},
	       	});
			
		},
		sendTalkMsg: function(){
			if(app.talkMsg == ''){
				return;
			}
			if(window.ws != null){
				ws.send('{"msgType":"1", "talkUsername":"' + this.loginUsername + '","talkMsg":"' + this.talkMsg + '"}');
				app.talkMsg = '';
			}
		}
	},
	filters: {
		fileTypeFilter: function(value){
			if(value == 1){
				return '文件';
			}else if(value == 2){
				return '文件夹';
			}
		},
	},
	beforeCreate: function(){	//组件初始化完毕后初始化页面
		console.log('组件初始化完毕');
		this.talkMsgList = window.talkMsgList;
		$.ajax({
			url: '/initHome',
			method: 'post',
			dataType: 'json',
			cache: false,
			success: (data) => {
				console.log(data);
				if(data.status == 1){
					this.loginUsername = data.loginUsername;
					this.fileList = data.fileList;
					init();
				}else{
					comfirmWithSureBtn('页面初始化失败', data.desc);
				}
			},
			error: (jqXHR, textStatus, errorThrown) => {
				comfirmWithSureBtn('出错啦', `服务器内部错误：${textStatus}`);
			}
		});
	}
});

//form表单下载文件
function downloadFileByForm(filePath) {
    var url = "/downloadFile";
    var form = $("<form></form>").attr("action", url).attr("method", "post");
    form.append($("<input></input>").attr("type", "hidden").attr("name", "filePath").attr("value", filePath));
    form.appendTo('body').submit().remove();
}

//获取指定名称的cookie的值
function getcookie(objname){	
	var arrstr = document.cookie.split("; ");
	for(var i = 0;i < arrstr.length;i ++){
		var temp = arrstr[i].split("=");
		if(temp[0] == objname) return unescape(temp[1]);
	}
	return '';
}


var ws = null;
function init(){
	//websocket配置------gtalk
	if(window.WebSocket){
        ws = new WebSocket('ws://' + urlPrefix + ':' + websocketPort);

        ws.onopen = function(e){
            console.log("websocket 连接服务器成功");
        }
        ws.onclose = function(e){
            console.log("websocket 服务器关闭");
        }
        ws.onerror = function(){
            console.log("websocket 连接出错");
        }

        ws.onmessage = function(e){
        	console.log("收到websocket(gtalk)信息：" + e.data);
        	var dataJson = JSON.parse(e.data);
        	if(dataJson.talkUsername == app.loginUsername){
        		dataJson['isSelfPush'] = true;
        	}else{
        		dataJson['isSelfPush'] = false;
        	}
        	app.talkMsgList.push(dataJson);
        	var talkMsgScrollWrap = $('#talkMsg-scroll-wrap');
        	talkMsgScrollWrap.niceScroll().resize();
        	talkMsgScrollWrap.stop(true);
        	talkMsgScrollWrap.animate({
                scrollTop:talkMsgScrollWrap.get(0).scrollHeight
            }, 300);
        }
    }
	
	$('#tabs li:eq(0) a').tab('show');


	var transitDepotDropzone = new Dropzone("#transit-depot-dropzone", {
	    url: "/uploadFiles",
	    addRemoveLinks: true,
	    dictRemoveFile: '取消',
	    dictCancelUpload: '取消上传',
	    dictFileTooBig: '{{filesize}}M对于单个文件容量上限{{maxFilesize}}M来说太大了，请重新选择文件',
	    method: 'post',
	    maxFilesize: 1024,
	    filesizeBase: 1024,
	    sending: function(file, xhr, formData) {
	    	formData.append("filesize", file.size);
	    },
	    success: function (file, response, e) {
//	      var res = JSON.parse(response);
//	      if (res.error) {
//	        $(file.previewTemplate).children('.dz-error-mark').css('opacity', '1')
//	      }
	   },
	    canceled: function(file) {
	    	console.log('删除');
	    }
	  });
	
	//初始化niceScroll
	initNiceScroll();
	
	//初始化侧边栏
	var trigger = $('.hamburger');
	var	overlay = $('.overlay');
	var	isClosed = false;
    trigger.click(function () {
    	hamburger_cross();      
    });
    function hamburger_cross() {
    	if(isClosed == true) {          
        	overlay.hide();
        	trigger.removeClass('is-open');
        	trigger.addClass('is-closed');
        	isClosed = false;
      	} else {   
        	overlay.show();
        	trigger.removeClass('is-closed');
        	trigger.addClass('is-open');
        	isClosed = true;
      	}
  	}
		  
  	$('[data-toggle="offcanvas"]').click(function () {
    	$('#wrapper').toggleClass('toggled');
  	});
	
}

function initNiceScroll(){
	$('body').niceScroll({
        cursorcolor: "#4B4B4B",//滚动条的颜色
        cursoropacitymax: 0.5, //滚动条的透明度，从0-1
        touchbehavior: false, //使光标拖动滚动像在台式电脑触摸设备
        cursorwidth: "6px", //滚动条的宽度
        cursorborder: "0", // 游标边框css定义
        cursorborderradius: "3px",//以像素为光标边界半径  圆角
        autohidemode: true, //是否隐藏滚动条  true的时候默认不显示滚动条，当鼠标经过的时候显示滚动条
        zindex:"auto",//给滚动条设置z-index值
        railpadding: { top:0, right:0, left:0, bottom:0 }//滚动条的位置
    });
    $('#talkMsg-scroll-wrap').niceScroll({
        cursorcolor: "#CCFF99",//滚动条的颜色
        cursoropacitymax: 0.8, //滚动条的透明度，从0-1
        touchbehavior: false, //使光标拖动滚动像在台式电脑触摸设备
        cursorwidth: "6px", //滚动条的宽度
        cursorborder: "0", // 游标边框css定义
        cursorborderradius: "3px",//以像素为光标边界半径  圆角
        autohidemode: true, //是否隐藏滚动条  true的时候默认不显示滚动条，当鼠标经过的时候显示滚动条
        zindex:"99999",//给滚动条设置z-index值
        railpadding: { top:0, right:0, left:0, bottom:0 }//滚动条的位置
    });
}
