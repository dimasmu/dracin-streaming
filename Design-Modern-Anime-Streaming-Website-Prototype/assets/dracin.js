(function(){
  /* ---- Header: subtitle language toggle (persisted) ---- */
  var buttons=document.querySelectorAll('[data-od-id="subtitle-language-toggle"] button');
  function setLanguage(value){buttons.forEach(function(button){button.classList.toggle('active',button.dataset.lang===value)});localStorage.setItem('dracin-subtitle',value)}
  buttons.forEach(function(button){button.addEventListener('click',function(){setLanguage(button.dataset.lang)})});
  var saved=localStorage.getItem('dracin-subtitle');if(saved)setLanguage(saved);

  /* ---- Header: day/night theme toggle (persisted) ---- */
  var themeButton=document.querySelector('[data-od-id="theme-toggle"]');
  function applyTheme(value){document.documentElement.setAttribute('data-theme',value);if(themeButton){themeButton.setAttribute('aria-checked',value==='light'?'true':'false');themeButton.setAttribute('aria-label',value==='light'?'Ganti ke mode malam':'Ganti ke mode siang')}}
  var savedTheme='dark';try{savedTheme=localStorage.getItem('dracin-theme')||'dark'}catch(e){}
  applyTheme(savedTheme);
  if(themeButton)themeButton.addEventListener('click',function(){var next=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';applyTheme(next);try{localStorage.setItem('dracin-theme',next)}catch(e){}});

  /* ---- Shared header: account menu ---- */
  var accountMenu=document.querySelector('[data-account-menu]');
  if(accountMenu){
    var accountTrigger=accountMenu.querySelector('.account-trigger');
    var accountDropdown=accountMenu.querySelector('.account-dropdown');
    var accountItems=accountMenu.querySelectorAll('[role="menuitem"]');
    function setAccountOpen(open,focusItem){
      accountDropdown.hidden=!open;
      accountTrigger.setAttribute('aria-expanded',open?'true':'false');
      if(open&&focusItem&&accountItems.length)accountItems[0].focus();
      if(!open)accountTrigger.focus();
    }
    accountTrigger.addEventListener('click',function(){
      setAccountOpen(accountDropdown.hidden,true);
    });
    accountItems.forEach(function(item){
      item.addEventListener('click',function(){setAccountOpen(false,false)});
    });
    accountMenu.addEventListener('keydown',function(event){
      if(event.key==='Escape'){
        event.preventDefault();
        if(!accountDropdown.hidden)setAccountOpen(false,false);
        return;
      }
      if(accountDropdown.hidden||!accountItems.length)return;
      var current=document.activeElement,index=Array.prototype.indexOf.call(accountItems,current);
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        var next=event.key==='ArrowDown'?index+1:index-1;
        if(next<0)next=accountItems.length-1;
        if(next>=accountItems.length)next=0;
        accountItems[next].focus();
      }else if(event.key==='Home'||event.key==='End'){
        event.preventDefault();
        accountItems[event.key==='Home'?0:accountItems.length-1].focus();
      }
    });
    document.addEventListener('click',function(event){
      if(!accountMenu.contains(event.target)&&!accountDropdown.hidden)setAccountOpen(false,false);
    });
  }

  /* =========================================================
     Shared tooltip formatters — rating stars, aired date, labels.
     Kept at IIFE scope so both browse and homepage renderers reuse them.
     ========================================================= */
  var MONTHS_ID=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  /* Full aired date in Indonesian long form: "7 Juni 2024". Falls back to the year. */
  function formatAired(d){
    var raw=d.aired;
    if(!raw)return d.year?String(d.year):'Belum tersedia';
    var parts=String(raw).split('-');
    if(parts.length!==3)return String(raw);
    var month=MONTHS_ID[Number(parts[1])-1];
    if(!month)return String(raw);
    return Number(parts[2])+' '+month+' '+parts[0];
  }

  /* Five-star scale rendered from a 0–10 rating. SVG only, never emoji. */
  function ratingStars(rating){
    if(typeof rating!=='number'||!isFinite(rating))return '';
    var filled=Math.round(rating/2);
    var stars='';
    for(var i=1;i<=5;i++){
      stars+='<svg class="star'+(i<=filled?' star-on':'')+'" viewBox="0 0 24 24" width="9" height="9" aria-hidden="true">'+
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    }
    return '<span class="card-tooltip-rating" title="Rating '+rating.toFixed(1)+' dari 10">'+stars+
      '<b>'+rating.toFixed(1)+'</b></span>';
  }

  /* Exposed for page-level renderers (browse.html builds its own grid markup). */
  window.dracinFormatAired=formatAired;
  window.dracinRatingStars=ratingStars;

  /* ---- Grouped single-select tabs (schedule day tabs, legacy) ---- */
  document.querySelectorAll('.day-tabs button').forEach(function(button){button.addEventListener('click',function(){var group=button.parentElement.querySelectorAll('button');group.forEach(function(item){item.classList.remove('active')});button.classList.add('active')})});

  /* =========================================================
     Header search — live dropdown with skeleton loading state.
     Typing debounces ~1.5s, shows shimmer skeleton rows, then
     renders elongated result rows (thumb + full tooltip metadata).
     ========================================================= */
  var search=document.querySelector('[data-od-id="header-search"]');
  if(search){
    var searchWrap=search.closest('.header-tools')||search.parentElement;
    var dropdown=document.createElement('div');
    dropdown.className='search-dropdown';
    dropdown.setAttribute('role','listbox');
    dropdown.setAttribute('aria-label','Hasil pencarian drama');
    searchWrap.appendChild(dropdown);
    search.setAttribute('autocomplete','off');
    search.setAttribute('aria-expanded','false');

    var SEARCH_DELAY=1500,debounceTimer=null,skeletonTimer=null,renderTimer=null;
    var slugify=function(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')};

    function closeDropdown(){dropdown.classList.remove('open');dropdown.innerHTML='';search.setAttribute('aria-expanded','false')}

    function skeletonMarkup(){
      var row='<div class="search-skeleton-row"><span class="search-skeleton-thumb"></span><span class="search-skeleton-lines"><span class="search-skeleton-line"></span><span class="search-skeleton-line"></span><span class="search-skeleton-line"></span></span></div>';
      return '<div class="search-skeleton">'+row+row+row+row+'</div>';
    }

    function resultMarkup(d){
      var alt=(d.title.match(/[A-Z]/g)||['D']).slice(0,2).join('');
      var href='dracin-watch.html?title='+encodeURIComponent(d.title)+'&platform='+encodeURIComponent(d.platform)+'&sub='+encodeURIComponent(d.sub)+'&episode='+d.episodes+'&id='+encodeURIComponent(d.id);
      return '<a class="search-result" role="option" href="'+href+'" data-od-id="search-'+slugify(d.id)+'">'+
        '<span class="search-result-thumb" style="--card-tone:'+d.tone+'"><span class="drama-art" data-monogram="'+alt+'"></span></span>'+
        '<span class="search-result-body">'+
          '<span class="search-result-title">'+d.title+'</span>'+
          '<span class="search-result-meta">'+
            ratingStars(d.rating)+
            '<span class="tag-episode">'+(d.episodes+' EP')+'</span>'+
            '<span class="tag-platform">'+d.platform+'</span>'+
          '</span>'+
          '<span class="search-result-synopsis">'+d.synopsis+'</span>'+
          '<span class="search-result-foot">'+
            '<span>Tayang: '+formatAired(d)+'</span>'+
            '<span class="search-genre">'+d.genre+'</span>'+
            '<span>Subtitle: '+d.sub+'</span>'+
          '</span>'+
        '</span></a>';
    }

    function runSearch(query){
      dropdown.innerHTML=skeletonMarkup();
      dropdown.classList.add('open');
      search.setAttribute('aria-expanded','true');
      clearTimeout(renderTimer);
      renderTimer=setTimeout(function(){
        var catalogue=window.DRACIN_CATALOGUE||[];
        var q=query.toLowerCase();
        var hits=catalogue.filter(function(d){
          return d.title.toLowerCase().indexOf(q)>-1||d.genre.toLowerCase().indexOf(q)>-1||d.platform.toLowerCase().indexOf(q)>-1||d.synopsis.toLowerCase().indexOf(q)>-1;
        }).slice(0,6);
        dropdown.innerHTML=hits.length
          ?hits.map(resultMarkup).join('')
          :'<div class="search-dropdown-empty">Tidak ada drama untuk “'+query+'”.</div>';
      },SEARCH_DELAY);
    }

    search.addEventListener('input',function(){
      var value=search.value.trim();
      clearTimeout(debounceTimer);clearTimeout(skeletonTimer);clearTimeout(renderTimer);
      if(value.length<2){closeDropdown();return}
      dropdown.innerHTML=skeletonMarkup();
      dropdown.classList.add('open');
      search.setAttribute('aria-expanded','true');
      debounceTimer=setTimeout(function(){runSearch(value)},120);
    });

    search.addEventListener('keydown',function(event){
      if(event.key==='Enter'&&search.value.trim())location.href='genre.html?q='+encodeURIComponent(search.value.trim());
      if(event.key==='Escape')closeDropdown();
    });

    document.addEventListener('click',function(event){
      if(!searchWrap.contains(event.target))closeDropdown();
    });
    search.addEventListener('focus',function(){if(search.value.trim().length>=2&&dropdown.innerHTML)dropdown.classList.add('open')});
  }

  /* ---- Header: Random drama navigation ---- */
  var randomLink=document.querySelector('[data-od-id="nav-random"]');
  if(randomLink&&window.DRACIN_CATALOGUE&&window.DRACIN_CATALOGUE.length){
    randomLink.addEventListener('click',function(event){
      var catalogue=window.DRACIN_CATALOGUE;
      var random=catalogue[Math.floor(Math.random()*catalogue.length)];
      var href='dracin-watch.html?title='+encodeURIComponent(random.title)+'&platform='+encodeURIComponent(random.platform)+'&sub='+encodeURIComponent(random.sub)+'&episode='+random.episodes+'&id='+encodeURIComponent(random.id);
      location.href=href;
    });
  }

  /* ---- Card link wiring (detail params) ---- */
  document.querySelectorAll('.drama-card').forEach(function(card){
    var title=card.querySelector('h3'),platform=card.querySelector('.card-platform'),locale=card.querySelector('.card-locale'),episode=card.querySelector('.card-copy p');
    if(title){
      var q='title='+encodeURIComponent(title.textContent.trim())+'&platform='+encodeURIComponent(platform?platform.textContent.trim():'DramaBox')+'&sub='+encodeURIComponent(locale?locale.textContent.trim():'EN')+'&episode='+encodeURIComponent(episode?episode.textContent.replace(/.*Episode\s*/,'').split('·')[0].trim():'1');
      card.href='dracin-watch.html?'+q;
    }
  });

  /* ---- Hero slider ---- */
  var slides=document.querySelectorAll('.hero-slide');
  if(slides.length){
    var dots=document.querySelectorAll('.slider-dot'),current=0,timer;
    function show(index){current=(index+slides.length)%slides.length;slides.forEach(function(s,i){s.classList.toggle('active',i===current)});dots.forEach(function(d,i){d.classList.toggle('active',i===current)})}
    function restart(){clearInterval(timer);timer=setInterval(function(){show(current+1)},7000)}
    document.querySelectorAll('[data-slider-step]').forEach(function(button){button.addEventListener('click',function(){show(current+Number(button.dataset.sliderStep));restart()})});
    dots.forEach(function(dot,i){dot.addEventListener('click',function(){show(i);restart()})});
    restart();
  }

  /* ---- Detail page params ---- */
  var params=new URLSearchParams(location.search),detailTitle=document.querySelector('[data-detail-title]');
  if(detailTitle&&params.get('title')){
    var title=params.get('title'),platform=params.get('platform')||'DramaBox',sub=params.get('sub')||'EN',episode=params.get('episode')||'1',slug=params.get('id')||'';
    document.querySelectorAll('[data-drama-title]').forEach(function(el){el.textContent=title});
    document.querySelectorAll('[data-drama-platform]').forEach(function(el){el.textContent=platform});
    document.querySelectorAll('[data-drama-sub]').forEach(function(el){el.textContent=sub});
    document.querySelectorAll('[data-drama-episode]').forEach(function(el){el.textContent=episode});
    document.querySelectorAll('[data-watch-link]').forEach(function(el){el.href='dracin-watch.html?'+params.toString()});
    var total=document.querySelector('[data-drama-total]');
    if(total&&window.DRACIN_CATALOGUE){
      var found=window.DRACIN_CATALOGUE.filter(function(d){return d.title===title})[0];
      if(found)total.textContent=found.episodes;
    }
  }
  document.querySelectorAll('.episode-button').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('.episode-button').forEach(function(item){item.classList.remove('active')});button.classList.add('active');var label=document.querySelector('[data-current-episode]');if(label)label.textContent='Episode '+button.dataset.episode})});

  /* =========================================================
     Multi-select browse engine — Genre & Platform pages
     ========================================================= */
  function initBrowse(){
    var grid=document.querySelector('[data-browse-grid]');
    if(!grid||!window.DRACIN_CATALOGUE)return;

     var page=grid.dataset.browsePage||'genre';
     if(page==='browse')return;
     var perPage=Number(grid.dataset.perPage||12);
    var facet=grid.dataset.facet||'genre';
    var countEl=document.querySelector('[data-browse-count]');
    var pagEl=document.querySelector('[data-browse-pagination]');
    var chipWrap=document.querySelector('[data-facet-chips]');
    var searchInput=document.querySelector('[data-browse-search]');
    var sortButtons=document.querySelectorAll('[data-sort]');
    var clearBtn=document.querySelector('[data-facet-clear]');
    var selected=new Set();
    var sort='popular';
    var query=new URLSearchParams(location.search).get('q')||'';

    /* Build facet chip set from catalogue (single source of truth) */
    if(chipWrap){
      var facets=(page==='platform'?window.DRACIN_PLATFORMS:window.DRACIN_GENRES)||[];
      facets=window.DRACIN_CATALOGUE.map(function(d){return d[facet]}).filter(function(v,i,a){return a.indexOf(v)===i}).sort();
      chipWrap.innerHTML=facets.map(function(name){
        var n=window.DRACIN_CATALOGUE.filter(function(d){return d[facet]===name}).length;
        return '<button class="filter-chip" type="button" data-facet="'+name+'" aria-pressed="false">'+name+'<span class="chip-count">'+n+'</span></button>';
      }).join('');
      chipWrap.querySelectorAll('[data-facet]').forEach(function(chip){
        chip.addEventListener('click',function(){
          var name=chip.dataset.facet;
          if(selected.has(name)){selected.delete(name)}else{selected.add(name)}
          chip.classList.toggle('active',selected.has(name));
          chip.setAttribute('aria-pressed',selected.has(name)?'true':'false');
          update();
        });
      });
    }

    if(clearBtn)clearBtn.addEventListener('click',function(){selected.clear();if(chipWrap)chipWrap.querySelectorAll('[data-facet]').forEach(function(c){c.classList.remove('active');c.setAttribute('aria-pressed','false')});if(searchInput)searchInput.value='';query='';update()});
    if(searchInput){if(query)searchInput.value=query;searchInput.addEventListener('input',function(){query=searchInput.value.trim().toLowerCase();update()})}
    sortButtons.forEach(function(button){button.addEventListener('click',function(){sort=button.dataset.sort;sortButtons.forEach(function(s){s.classList.toggle('active',s===button)});update()})});

    function filtered(){
      return window.DRACIN_CATALOGUE.filter(function(d){
        if(selected.size&&!selected.has(d[facet]))return false;
        if(query){
          var hay=(d.title+' '+d.platform+' '+d.genre).toLowerCase();
          if(hay.indexOf(query)<0)return false;
        }
        return true;
      }).sort(function(a,b){
        if(sort==='new')return b.year-a.year||b.episodes-a.episodes;
        if(sort==='full')return b.episodes-a.episodes;
        if(sort==='az')return a.title.localeCompare(b.title);
        return b.episodes*1000+b.year-a.episodes*1000-a.year;
      });
    }

    function cardMarkup(d){
      var alt=(d.title.match(/[A-Za-z]/g)||['D']).slice(0,2).join('').toUpperCase();
      var episodeCount=String(d.episodes);
      var synopsis=d.synopsis||'Metadata drama, platform, subtitle, dan jumlah episode tersedia di halaman detail.';
      var mins=d.episodes*2;
      var dur=(mins>=60?(Math.floor(mins/60)+'j '+(''+(mins%60)).padStart(2,'0')+'m'):(mins+'m'));
      return '<a class="drama-card" href="#" style="--card-tone:'+d.tone+'" data-od-id="'+page+'-card-'+d.id+'"'+
        ' data-id="'+d.id+'" data-title="'+d.title+'" data-genre="'+d.genre+'" data-platform="'+d.platform+'" data-sub="'+d.sub+'" data-episodes="'+d.episodes+'" data-year="'+d.year+'">'+
        '<span class="card-thumb"><span class="drama-art" data-monogram="'+alt+'"></span><span class="card-shade"></span>'+
        '<span class="card-platform">'+d.platform+'</span><span class="card-locale">'+d.sub+'</span>'+
        '<span class="card-play-overlay" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></span></span>'+
        '<span class="card-copy card-info">'+
         '<h3 class="card-title">'+d.title+'</h3><p class="card-episode-line"><i class="episode-dot"></i> Episode '+episodeCount+' · '+d.genre+'</p></span>'+
        '<span class="card-tooltip">'+
          '<span class="card-tooltip-skeleton"><span class="skel-title"></span><span class="skel-meta"><span></span><span></span><span></span></span><span class="skel-synopsis"></span><span class="skel-aired"></span><span class="skel-genre"></span><span class="skel-sub"></span></span>'+
          '<span class="card-tooltip-title">'+d.title+'</span>'+
          '<span class="card-tooltip-meta">'+
            ratingStars(d.rating)+
            '<span class="tag-episode">'+episodeCount+' EP</span>'+
            '<span class="tag-platform">'+d.platform+'</span>'+
          '</span>'+
          '<span class="card-tooltip-synopsis">'+synopsis+'</span>'+
          '<span class="card-tooltip-aired">Tayang: '+formatAired(d)+'</span>'+
          '<span class="card-tooltip-genre"><span>'+d.genre+'</span></span>'+
          '<span class="card-tooltip-sub">Subtitle: '+d.sub+' · '+dur+' total tayang</span>'+
        '</span></a>';
    }
    var currentPage=1;
    function update(resetPage){
      var list=filtered();
      if(resetPage!==false)currentPage=1;
      var pages=Math.max(1,Math.ceil(list.length/perPage));
      if(currentPage>pages)currentPage=pages;
      var slice=list.slice((currentPage-1)*perPage,currentPage*perPage);

      grid.innerHTML=slice.length?slice.map(cardMarkup).join(''):'<p class="browse-empty">Tidak ada judul yang cocok dengan filter ini. Coba kurangi pilihan atau tekan Reset.</p>';

      /* rewire detail links for freshly injected cards */
      grid.querySelectorAll('.drama-card').forEach(function(card){
        var h3=card.querySelector('h3'),plat=card.querySelector('.card-platform'),loc=card.querySelector('.card-locale'),ep=card.querySelector('.card-copy p');
        if(h3){
          var rec=window.DRACIN_CATALOGUE.filter(function(d){return d.title===h3.textContent.trim()})[0];
          var q='title='+encodeURIComponent(h3.textContent.trim())+'&platform='+encodeURIComponent(plat?plat.textContent.trim():'DramaBox')+'&sub='+encodeURIComponent(loc?loc.textContent.trim():'EN')+'&episode='+encodeURIComponent(ep?ep.textContent.replace(/.*Episode\s*/,'').split('·')[0].trim():'1');
          if(rec)q+='&id='+encodeURIComponent(rec.id);
          card.href='dracin-watch.html?'+q;
        }
      });

      if(countEl)countEl.textContent=list.length+' drama ditemukan'+(selected.size?' · '+selected.size+' filter aktif':'');

      if(pagEl){
        if(pages<=1){pagEl.innerHTML='';return}
        var html='<button class="page-btn" type="button" data-goto="'+(currentPage-1)+'"'+(currentPage===1?' disabled':'')+'>‹</button>';
        for(var i=1;i<=pages;i++){
          if(pages>7&&i>2&&i<pages-1&&Math.abs(i-currentPage)>1){if(i===3)html+='<span class="page-gap">…</span>';continue}
          html+='<button class="page-btn'+(i===currentPage?' active':'')+'" type="button" data-goto="'+i+'">'+i+'</button>';
        }
        html+='<button class="page-btn" type="button" data-goto="'+(currentPage+1)+'"'+(currentPage===pages?' disabled':'')+'>›</button>';
        pagEl.innerHTML=html;
        pagEl.querySelectorAll('[data-goto]').forEach(function(button){
          button.addEventListener('click',function(){
            var go=Number(button.dataset.goto);
            if(go<1||go>pages||go===currentPage)return;
            currentPage=go;update(false);
            grid.scrollIntoView({behavior:'smooth',block:'start'});
          });
        });
      }
    }

    update();
  }

  initBrowse();

  /* =========================================================
     Tooltip edge-flip — cards near viewport edge flip inward.
     Runs on load, after DOM updates, and on resize.
     ========================================================= */
  function applyTooltipEdges(){
    var cards=document.querySelectorAll('.drama-card');
    if(!cards.length)return;
    var vw=document.documentElement.clientWidth;
    cards.forEach(function(card){
      var r=card.getBoundingClientRect();
      card.removeAttribute('data-tooltip-edge');
      if(r.right>vw-300)card.setAttribute('data-tooltip-edge','right');
      else if(r.left<300)card.setAttribute('data-tooltip-edge','left');
    });
  }
  window.applyTooltipEdges=applyTooltipEdges;

  /* =========================================================
     Mouse-drag scroll — horizontal rails become draggable.
     ========================================================= */
  function initDragScroll(){
    document.querySelectorAll('.carousel,.rail').forEach(function(rail){
      var down=false,start=0,scroll=0;
      rail.addEventListener('mousedown',function(e){down=true;start=e.pageX;scroll=rail.scrollLeft;rail.style.cursor='grabbing';rail.style.userSelect='none'});
      rail.addEventListener('mousemove',function(e){if(!down)return;e.preventDefault();rail.scrollLeft=scroll-(e.pageX-start)});
      rail.addEventListener('mouseup',function(){down=false;rail.style.cursor='grab';rail.style.userSelect=''});
      rail.addEventListener('mouseleave',function(){down=false;rail.style.cursor='grab';rail.style.userSelect=''});
    });
  }

  /* =========================================================
     Homepage: Latest Episodes, Featured, Trending (12 cards each)
     + Most Viewed / Most Liked horizontal ranked lists.
     ========================================================= */
  function initHomepage(){
    var latestGrid=document.querySelector('[data-home-latest]');
    var featuredGrid=document.querySelector('[data-home-featured]');
    var trendingGrid=document.querySelector('[data-home-trending]');
    var mostViewedList=document.querySelector('[data-home-most-viewed]');
    var mostLikedList=document.querySelector('[data-home-most-liked]');
    if(!latestGrid&&!featuredGrid&&!trendingGrid&&!mostViewedList&&!mostLikedList)return;
    var catalogue=(window.DRACIN_CATALOGUE||[]).slice();
    if(!catalogue.length)return;

    var slug=function(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')};
    var byRecency=catalogue.slice().sort(function(a,b){return (b.year*1000+b.episodes)-(a.year*1000+a.episodes)});

    function cardMarkup(d,section){
      var alt=(d.title.match(/[A-Z]/g)||['D']).slice(0,2).join('');
      var episodeCount=d.episode?String(d.episode):String(d.episodes);
      var synopsis=d.synopsis||'Metadata drama, platform, subtitle, dan jumlah episode tersedia di halaman detail.';
      var mins=d.episodes*2;
      var dur=(mins>=60?(Math.floor(mins/60)+'j '+(''+(mins%60)).padStart(2,'0')+'m'):(mins+'m'));
      var detailLink='dracin-watch.html?title='+encodeURIComponent(d.title)+'&platform='+encodeURIComponent(d.platform)+'&sub='+encodeURIComponent(d.sub)+'&episode='+d.episodes+'&id='+encodeURIComponent(d.id);
      return '<a class="drama-card" href="'+detailLink+'" style="--card-tone:'+d.tone+'" data-od-id="'+section+'-'+slug(d.id)+'" data-title="'+d.title+'" data-genre="'+d.genre+'" data-platform="'+d.platform+'" data-sub="'+d.sub+'" data-episodes="'+d.episodes+'" data-year="'+d.year+'">'+
        '<span class="card-thumb"><span class="drama-art" data-monogram="'+alt+'"></span><span class="card-shade"></span>'+
        '<span class="card-platform">'+d.platform+'</span><span class="card-locale">'+d.sub+'</span>'+
        '<span class="card-play-overlay" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></span></span>'+
      '<span class="card-copy card-info"><h3 class="card-title">'+d.title+'</h3><p class="card-episode-line"><i class="episode-dot"></i> Episode '+episodeCount+' · '+d.genre+'</p></span>'+
       '<span class="card-tooltip">'+
         '<span class="card-tooltip-skeleton"><span class="skel-title"></span><span class="skel-meta"><span></span><span></span><span></span></span><span class="skel-synopsis"></span><span class="skel-aired"></span><span class="skel-genre"></span><span class="skel-sub"></span></span>'+
         '<span class="card-tooltip-title">'+d.title+'</span>'+
         '<span class="card-tooltip-meta">'+
           ratingStars(d.rating)+
           '<span class="tag-episode">'+episodeCount+' EP</span>'+
           '<span class="tag-platform">'+d.platform+'</span>'+
         '</span>'+
         '<span class="card-tooltip-synopsis">'+synopsis+'</span>'+
         '<span class="card-tooltip-aired">Tayang: '+formatAired(d)+'</span>'+
         '<span class="card-tooltip-genre"><span>'+d.genre+'</span></span>'+
         '<span class="card-tooltip-sub">Subtitle: '+d.sub+' · '+dur+' total tayang</span>'+
       '</span></a>';
    }

    if(latestGrid){
      latestGrid.innerHTML=byRecency.slice(0,12).map(function(d){return cardMarkup(d,'latest')}).join('');
    }

    if(featuredGrid){
      var featured=byRecency.slice(12,24);
      featuredGrid.innerHTML=featured.map(function(d){return cardMarkup(d,'featured')}).join('');
    }

    if(trendingGrid){
      var trending=byRecency.slice(24,36);
      trendingGrid.innerHTML=trending.map(function(d){return cardMarkup(d,'trending')}).join('');
    }

    /* Most Viewed ranking */
    if(mostViewedList){
      var viewed=catalogue.slice().sort(function(a,b){return (b.episodes*3+b.year)-(a.episodes*3+a.year)}).slice(0,10);
      mostViewedList.innerHTML=viewed.map(function(d,i){
        return '<a class="rank-row" href="dracin-watch.html?title='+encodeURIComponent(d.title)+'&platform='+encodeURIComponent(d.platform)+'&sub='+encodeURIComponent(d.sub)+'&episode='+d.episodes+'&id='+encodeURIComponent(d.id)+'" style="--card-tone:'+d.tone+'" data-od-id="rank-viewed-'+(i+1)+'">'+
          '<span class="rank-num">'+(i+1)+'</span><span class="rank-thumb"></span>'+
          '<span class="rank-info"><h3>'+d.title+'</h3><p>'+d.genre+' · '+d.platform+' · '+d.episodes+' EP</p></span></a>';
      }).join('');
    }

    /* Most Liked ranking */
    if(mostLikedList){
      var liked=catalogue.slice().sort(function(a,b){return (b.year*4+(b.episodes%90))-(a.year*4+(a.episodes%90))}).slice(0,10);
      mostLikedList.innerHTML=liked.map(function(d,i){
        return '<a class="rank-row" href="dracin-watch.html?title='+encodeURIComponent(d.title)+'&platform='+encodeURIComponent(d.platform)+'&sub='+encodeURIComponent(d.sub)+'&episode='+d.episodes+'&id='+encodeURIComponent(d.id)+'" style="--card-tone:'+d.tone+'" data-od-id="rank-liked-'+(i+1)+'">'+
          '<span class="rank-num">'+(i+1)+'</span><span class="rank-thumb"></span>'+
          '<span class="rank-info"><h3>'+d.title+'</h3><p>'+d.genre+' · '+d.platform+' · '+d.episodes+' EP</p></span></a>';
      }).join('');
    }

    /* Genre-filtered carousel — tab buttons filter the catalogue by genre */
    var genreCarousel=document.querySelector('[data-home-genre]');
    if(genreCarousel){
      var genreTabs=document.querySelectorAll('[data-genre-tab]');
      var byPopularity=catalogue.slice().sort(function(a,b){return (b.episodes*1000+b.year)-(a.episodes*1000+a.year)});

      function renderGenre(genre){
        var list=(genre&&genre!=='Semua')?byPopularity.filter(function(d){return d.genre===genre}):byPopularity;
        list=list.slice(0,12);
        genreCarousel.innerHTML=list.length
          ?list.map(function(d){return cardMarkup(d,'genre-'+slug(genre||'semua'))}).join('')
          :'<p class="browse-empty">Belum ada judul untuk genre ini.</p>';
        genreCarousel.scrollLeft=0;
      }

      genreTabs.forEach(function(tab){
        tab.addEventListener('click',function(){
          genreTabs.forEach(function(item){item.classList.remove('active')});
          tab.classList.add('active');
          renderGenre(tab.dataset.genreTab);
          applyTooltipEdges();
        });
      });

      renderGenre('Semua');
    }

    /* Wire card links after injection */
    document.querySelectorAll('.drama-card').forEach(function(card){
      var title=card.querySelector('h3'),platform=card.querySelector('.card-platform'),locale=card.querySelector('.card-locale'),episode=card.querySelector('.card-copy p');
      if(title){
        var rec=catalogue.filter(function(d){return d.title===title.textContent.trim()})[0];
        if(rec){
          var q='title='+encodeURIComponent(rec.title)+'&platform='+encodeURIComponent(rec.platform)+'&sub='+encodeURIComponent(rec.sub)+'&episode='+rec.episodes+'&id='+encodeURIComponent(rec.id);
          card.href='dracin-watch.html?'+q;
        }
      }
    });

    applyTooltipEdges();
    initDragScroll();
  }

  initHomepage();

  /* =========================================================
      Watch page — like / dislike controls (YouTube-style).
      Mutually exclusive, toggles off on second press, and the
      displayed counts update to match the state.
     ========================================================= */
  (function initVoteBar(){
    var bar=document.querySelector('[data-od-id="watch-vote"]');
    if(!bar)return;
    var likeBtn=bar.querySelector('.vote-like'),dislikeBtn=bar.querySelector('.vote-dislike');
    if(!likeBtn||!dislikeBtn)return;

    var baseLikes=3200,baseDislikes=478;

    /* Indonesian short count: 3.2rb, 12rb, 1,4jt */
    function formatCount(n){
      if(n>=1000000)return String(Math.round(n/100000)/10).replace('.',',')+'jt';
      if(n>=10000)return Math.round(n/1000)+'rb';
      if(n>=1000)return String(Math.round(n/100)/10).replace('.',',')+'rb';
      return String(n);
    }

    function render(state){
      var likes=baseLikes+(state==='like'?1:0);
      var dislikes=baseDislikes+(state==='dislike'?1:0);
      likeBtn.setAttribute('aria-pressed',state==='like'?'true':'false');
      dislikeBtn.setAttribute('aria-pressed',state==='dislike'?'true':'false');
      likeBtn.querySelector('.vote-count').textContent=formatCount(likes);
      var dislikeCount=dislikeBtn.querySelector('.vote-count');
      if(dislikeCount)dislikeCount.textContent=formatCount(dislikes);
    }

    var current='';
    function choose(next){current=current===next?'':next;render(current)}
    likeBtn.addEventListener('click',function(){choose('like')});
    dislikeBtn.addEventListener('click',function(){choose('dislike')});
    render('');
  })();

  /* Re-run tooltip edges on resize */
  var edgeTimer;window.addEventListener('resize',function(){clearTimeout(edgeTimer);edgeTimer=setTimeout(applyTooltipEdges,150)});
})();
