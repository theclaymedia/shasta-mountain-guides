  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold:.1 });
  document.querySelectorAll('.reveal').forEach(function(el){
    if(reduce){ el.classList.add('in'); } else { io.observe(el); }
  });

  /* Forms: post to Netlify Forms when hosted there, then swap in the thank-you state.
     In the mockup (or off Netlify) the thank-you still shows so the flow can be reviewed. */
  function encode(form){
    var pairs = [];
    new FormData(form).forEach(function(v,k){ pairs.push(encodeURIComponent(k)+'='+encodeURIComponent(v)); });
    return pairs.join('&');
  }
  function showThanks(form){
    var wrap = form.closest('.res') || form;
    var thanks = wrap.querySelector('.thanks');
    if(form.classList.contains('contact-form')){
      Array.prototype.forEach.call(form.children, function(c){ if(!c.classList.contains('thanks')) c.hidden = true; });
    } else {
      form.hidden = true;
    }
    if(thanks){ thanks.hidden = false; thanks.setAttribute('tabindex','-1'); thanks.focus(); }
  }
  function wire(form){
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      if(!form.reportValidity()) return;
      var pick = form.querySelector('select[name="trip-type"]');
      if(pick){ var link = document.getElementById('gear-link'); if(link){ link.href = pick.value; link.textContent = 'download the ' + pick.options[pick.selectedIndex].text + ' gear list now'; } }
      var done = function(){ showThanks(form); };
      try{
        fetch('/', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:encode(form) }).then(done, done);
      }catch(e){ done(); }
    });
  }
  document.querySelectorAll('.lead-form, .contact-form').forEach(wire);

  /* Route quiz: score the three answers, show a recommendation, then offer to email it. */
  var ROUTES = {
    gulch:   { name:'Avalanche Gulch', why:'The classic. Non-technical, well travelled and the route most first-time Shasta climbers summit on. Best April through June on a two-day guided climb.', href:'https://shastaguides.com/climbmtshasta', label:'See the Climb Shasta trip' },
    clear:   { name:'Clear Creek', why:'The late-season choice once the Gulch melts out. Long, non-technical and quiet, with a huge view east. Best late July into September.', href:'https://shastaguides.com/climbmtshasta', label:'See the Climb Shasta trip' },
    north:   { name:'Hotlum-Bolam Ridge', why:'The wild side. Real glaciers, far fewer people and a stronger sense of expedition. For climbers with some crampon and ice-axe experience, or on a glacier seminar. Best June and July.', href:'https://shastaguides.com/custom', label:'Ask about a north side climb' },
    casaval: { name:'Casaval Ridge', why:'Shasta’s most aesthetic line. Exposed ridge climbing on snow and rock that rewards fit, experienced mountaineers. Prime in April and May.', href:'https://shastaguides.com/custom', label:'Ask about Casaval Ridge' },
    ski:     { name:'Ski Mountaineering Descent', why:'Climb it, then ride it. Avalanche Gulch, the West Face or Green Butte depending on the snow. We match the line to your turns. Best April through June.', href:'https://shastaguides.com/skishasta', label:'See the Ski Shasta trip' },
    course:  { name:'Mountaineering Course first', why:'For a late-season first climb we recommend a short skills course or a Clear Creek climb so you learn crampons and self-arrest before committing to a summit push.', href:'https://shastaguides.com/mountaineeering', label:'See mountaineering courses' }
  };
  function pickRoute(a){
    if(a.goal === 'ski') return 'ski';
    if(a.goal === 'technical') return a.experience === 'expert' && a.season !== 'late' ? 'casaval' : 'north';
    if(a.goal === 'quiet') return a.experience === 'first' ? (a.season === 'late' ? 'clear' : 'gulch') : 'north';
    if(a.season === 'late') return a.experience === 'first' ? 'course' : 'clear';
    return 'gulch';
  }
  var quiz = document.getElementById('route-quiz');
  if(quiz){
    var stage = 0;
    quiz.addEventListener('submit', function(ev){
      ev.preventDefault();
      if(!quiz.reportValidity()) return;
      if(stage === 0){
        var a = { experience: quiz.experience.value, season: quiz.season.value, goal: quiz.goal.value };
        var r = ROUTES[pickRoute(a)];
        var box = document.getElementById('quiz-result');
        box.innerHTML = '<b>' + r.name + '</b><p>' + r.why + '</p><a class="trip-link" href="' + r.href + '">' + r.label + ' &rsaquo;</a>';
        box.hidden = false;
        document.getElementById('quiz-route-field').value = r.name;
        document.getElementById('quiz-email-wrap').hidden = false;
        document.getElementById('quiz-btn').textContent = 'Email me this';
        document.getElementById('quiz-fine').textContent = 'We’ll include a trip suggestion and dates that fit.';
        quiz.querySelectorAll('fieldset').forEach(function(f){ f.hidden = true; });
        box.setAttribute('tabindex','-1'); box.focus();
        stage = 1;
        return;
      }
      var email = document.getElementById('qz-email');
      if(!email.value){ email.setCustomValidity('Add your email so we can send it.'); email.reportValidity(); email.setCustomValidity(''); return; }
      var done = function(){ showThanks(quiz); };
      try{
        fetch('/', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:encode(quiz) }).then(done, done);
      }catch(e){ done(); }
    });
  }
