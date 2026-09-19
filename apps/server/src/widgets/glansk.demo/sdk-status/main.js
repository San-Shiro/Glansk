Glansk.connect().then(widget=>{
  widget.onConfig(config=>{document.querySelector('#label').textContent=config.label});
  widget.subscribe('showcase/operations',delivery=>{if(delivery.kind!=='snapshot')return;const state=delivery.payload;document.querySelector('#status').textContent=state.status;document.querySelector('#detail').textContent=`${state.detail} r${delivery.revision}`;document.querySelector('#value').value=state.value;document.body.dataset.stateRevision=String(delivery.revision)});
  widget.reportReady();
});
