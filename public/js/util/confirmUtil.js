function comfirmWithSureBtn(title, content, callback){
	$.confirm({
		title: title,
	    content: content,
	    buttons: {
            ok: {
                text: '好的',
                keys: ['enter'],
                btnClass: 'btn-blue',
                action: callback
            },
        },
	});
}
