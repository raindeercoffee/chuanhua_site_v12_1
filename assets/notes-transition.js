(function () {
  'use strict';
  const base='/chuanhua_site_v12_1/assets/';
  const plants=['lavender','chamomile','rosemary','rose','jasmine','olive','mint','lemon','geranium','eucalyptus'];
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let finishCurrent=null, observer=null;
  const seen=new WeakSet();

  function cancel(){ if(finishCurrent) finishCurrent(); }
  function play(){
    cancel();
    if(reduced()) return Promise.resolve();
    return new Promise(resolve=>{
      const layer=document.createElement('div');
      layer.className='notes-opening';
      layer.setAttribute('role','button');
      layer.setAttribute('aria-label','跳過開書動畫');
      layer.tabIndex=0;
      const ring=document.createElement('div');
      ring.className='notes-opening-ring';
      plants.forEach((name,i)=>{
        const img=document.createElement('img');
        img.src=base+'quiz-plants/'+name+'.png'; img.alt='';
        img.style.setProperty('--angle',(i*360/plants.length)+'deg');
        ring.appendChild(img);
      });
      const book=document.createElement('div'); book.className='notes-opening-book';
      book.innerHTML='<div class="notes-opening-paper"></div><div class="notes-opening-cover"><div class="notes-opening-cover-front"><img src="'+base+'quiz-plants/lavender.png" alt=""><span>川花筆記</span></div></div>';
      const hint=document.createElement('span'); hint.className='notes-opening-hint'; hint.textContent='點一下，翻開筆記';
      layer.append(ring,book,hint); document.body.appendChild(layer);
      layer.focus({preventScroll:true});
      let done=false, timer;
      function finish(){
        if(done)return; done=true; clearTimeout(timer); layer.remove();
        if(finishCurrent===finish)finishCurrent=null;
        resolve();
      }
      finishCurrent=finish;
      layer.addEventListener('click',finish);
      layer.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '||e.key==='Escape'){e.preventDefault();finish();}});
      timer=setTimeout(finish,1350);
    });
  }
  function animateVisible(panel, direct){
    if(observer){observer.disconnect();observer=null;}
    if(!panel)return;
    const isList=panel.dataset.feature==='notes';
    const isArticle=panel.classList.contains('note-article');
    if(!isList&&!isArticle)return;
    if(isList&&direct)return;
    const targets=isList?[...panel.querySelectorAll('.note-card')]:[...panel.querySelectorAll('.st-head > h1,.st-head > p,.note-prose > *')];
    if(reduced()){
      targets.filter(el=>!seen.has(el)).forEach(el=>{seen.add(el);el.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-out'});});
      return;
    }
    if(isList){
      targets.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,delay:Math.min(i,6)*80,easing:'ease-out',fill:'backwards'}));
      return;
    }
    observer=new IntersectionObserver(entries=>{
      let delay=0;
      entries.forEach(entry=>{
        const el=entry.target;
        if(!entry.isIntersecting||seen.has(el))return;
        seen.add(el); observer.unobserve(el);
        el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,delay:Math.min(delay++*80,400),easing:'ease-out',fill:'backwards'});
      });
    },{root:document.getElementById('feature'),threshold:0.08});
    targets.filter(el=>!seen.has(el)).forEach(el=>observer.observe(el));
  }
  window.RiverNotes={play,cancel,animateVisible};
})();
