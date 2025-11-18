const LS_KEY = 'todo_with_categories_v1';
let state = {
  categories: [],
  tasks: [],      
  filter: { categoryId: null, status: 'all', search: '', sort: 'new' }
};
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) state = JSON.parse(raw);
  }catch(e){ console.error('load', e) }
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); render(); }

function seed(){
  if(state.categories.length) return;
  state.categories = [
    {id:'c_work', name:'Work'},
    {id:'c_personal', name:'Personal'},
    {id:'c_study', name:'Study'}
  ];
  state.tasks = [
    {id:uid(), title:'Finish lab assignment', categoryId:'c_study', done:false, createdAt:Date.now()-1000*60*60*24},
    {id:uid(), title:'Prepare presentation', categoryId:'c_work', done:false, createdAt:Date.now()-1000*60*60*8},
    {id:uid(), title:'Buy groceries', categoryId:'c_personal', done:true, createdAt:Date.now()-1000*60*60*4}
  ];
  save();
}
const categoriesEl = $('categories');
const categorySelect = $('categorySelect');
const categoryInput = $('newCategoryInput');
const addCategoryBtn = $('addCategoryBtn');
const taskInput = $('taskInput');
const addTaskBtn = $('addTaskBtn');
const taskList = $('taskList');
const footer = $('footer');
const searchInput = $('searchInput');
const statusFilter = $('statusFilter');
const sortSelect = $('sortSelect');
const clearCompleted = $('clearCompleted');
const addSample = $('addSample');

// Renders
function renderCategories(){
  categoriesEl.innerHTML = '';
  
  const all = document.createElement('div');
  all.className = 'cat ' + (state.filter.categoryId===null ? 'active':'');
  all.innerHTML = `<span>All</span><span class="count">${state.tasks.length}</span>`;
  all.onclick = ()=>{ state.filter.categoryId = null; render(); };
  categoriesEl.appendChild(all);

  state.categories.forEach(cat=>{
    const cnt = state.tasks.filter(t=>t.categoryId===cat.id).length;
    const el = document.createElement('div'); 
    el.className='cat'+(state.filter.categoryId===cat.id? ' active':'');
    el.innerHTML = `<span>${cat.name}</span><span class="count">${cnt}</span><button class="del-cat" title="Delete category">✖</button>`;
    el.querySelector('.del-cat').onclick = (e)=>{ e.stopPropagation(); deleteCategory(cat.id); };
    el.onclick = ()=>{ state.filter.categoryId = cat.id; render(); };
    categoriesEl.appendChild(el);
  });

  categorySelect.innerHTML = '';
  state.categories.forEach(cat=>{
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

function renderTasks(){
  let tasks = [...state.tasks];
  if(state.filter.categoryId) tasks = tasks.filter(t=>t.categoryId===state.filter.categoryId);
  if(state.filter.status==='active') tasks = tasks.filter(t=>!t.done);
  if(state.filter.status==='completed') tasks = tasks.filter(t=>t.done);
  if(state.filter.search) tasks = tasks.filter(t=>t.title.toLowerCase().includes(state.filter.search.toLowerCase()));

  if(state.filter.sort==='new') tasks.sort((a,b)=>b.createdAt-a.createdAt);
  else if(state.filter.sort==='old') tasks.sort((a,b)=>a.createdAt-b.createdAt);
  else if(state.filter.sort==='alpha') tasks.sort((a,b)=>a.title.localeCompare(b.title));

  taskList.innerHTML = '';
  if(tasks.length===0){
    taskList.innerHTML = '<div style="color:var(--muted)">No tasks found — add your first task!</div>';
    return;
  }

  tasks.forEach(task=>{
    const t = document.createElement('div'); 
    t.className='task'; 
    t.draggable = true; 
    t.dataset.id = task.id;

    const cat = state.categories.find(c=>c.id===task.categoryId)?.name || '—';

    t.innerHTML = `
      <div class="left">
        <div style="display:flex;gap:10px;align-items:center">
          <input type="checkbox" ${task.done? 'checked':''} aria-label="Mark complete">
          <div>
            <div class="title ${task.done? 'complete':''}" contenteditable="false">${escapeHtml(task.title)}</div>
            <div class="meta">${new Date(task.createdAt).toLocaleString()} • <span class="chip">${cat}</span></div>
          </div>
        </div>
      </div>
      <div class="actions">
        <div class="cta">
          <button class="icon-btn edit">Edit</button>
          <button class="icon-btn delete">Delete</button>
        </div>
      </div>`;

    const checkbox = t.querySelector('input[type=checkbox]');
    checkbox.addEventListener('change', ()=>{ toggleDone(task.id); });
    t.querySelector('.delete').addEventListener('click', ()=>{ deleteTask(task.id); });
    t.querySelector('.edit').addEventListener('click', ()=>{ editTaskInline(t, task.id); });

    t.addEventListener('dragstart', (e)=>{
      t.classList.add('dragging'); 
      e.dataTransfer.setData('text/plain', task.id);
    });
    t.addEventListener('dragend', ()=>{ t.classList.remove('dragging'); });

    t.addEventListener('dragover', e=>{
      e.preventDefault();
      const dragging = document.querySelector('.dragging'); 
      if(!dragging) return;
      const rect = t.getBoundingClientRect(); 
      const after = (e.clientY - rect.top) > (rect.height/2);
      t.style.borderTop = after ? '' : '2px solid rgba(255,255,255,0.04)';
      t.style.borderBottom = after ? '2px solid rgba(255,255,255,0.04)' : '';
    });

    t.addEventListener('dragleave', ()=>{
      t.style.borderTop='';
      t.style.borderBottom='';
    });

    t.addEventListener('drop', e=>{
      e.preventDefault();
      t.style.borderTop='';
      t.style.borderBottom='';
      const dragId = e.dataTransfer.getData('text/plain');
      if(!dragId) return;
      reorderTasks(dragId, task.id, e.clientY > t.getBoundingClientRect().top + t.getBoundingClientRect().height/2);
    });

    taskList.appendChild(t);
  });
}

function renderFooter(){
  const total = state.tasks.length;
  const done = state.tasks.filter(t=>t.done).length;
  footer.textContent = `${done} completed • ${total - done} remaining • ${total} total`;
}

function render(){ renderCategories(); renderTasks(); renderFooter(); }

// CRUD
function deleteCategory(id){
  state.tasks = state.tasks.filter(t=>t.categoryId!==id);
  state.categories = state.categories.filter(c=>c.id!==id);
  if(state.filter.categoryId===id) state.filter.categoryId=null;
  save();
}

function addCategory(name){ 
  if(!name) return; 
  const id = 'c_'+uid(); 
  state.categories.push({id,name}); 
  save(); 
}

function addTask(title, categoryId){ 
  if(!title) return; 
  const task = {id:uid(), title, categoryId, done:false, createdAt:Date.now()};
  state.tasks.push(task); 
  save(); 
}

function toggleDone(id){ 
  const t = state.tasks.find(x=>x.id===id); 
  if(t){ t.done = !t.done; save(); } 
}

function deleteTask(id){ 
  state.tasks = state.tasks.filter(t=>t.id!==id); 
  save(); 
}

function editTaskInline(rowEl, id){ 
  const task = state.tasks.find(t=>t.id===id); 
  if(!task) return; 
  const titleEl = rowEl.querySelector('.title'); 
  titleEl.contentEditable = true; 
  titleEl.focus(); 
  document.execCommand('selectAll', false, null);
  const blurHandler = ()=>{
    titleEl.contentEditable = false; 
    task.title = titleEl.textContent.trim() || task.title; 
    save(); 
    titleEl.removeEventListener('blur', blurHandler); 
  };
  titleEl.addEventListener('blur', blurHandler);
}

function reorderTasks(dragId, targetId, insertAfter){
  const tasks = [...state.tasks];
  const dragIndex = tasks.findIndex(t=>t.id===dragId);
  const targetIndex = tasks.findIndex(t=>t.id===targetId);
  if(dragIndex<0 || targetIndex<0 || dragIndex===targetIndex) return;
  const [item] = tasks.splice(dragIndex,1);
  const newIndex = insertAfter ? targetIndex+ (dragIndex<targetIndex?0:1) : targetIndex + (dragIndex<targetIndex? -1:0);
  tasks.splice(newIndex,0,item);
  state.tasks = tasks; 
  save();
}

function escapeHtml(str){ 
  return str.replace(/[&<>"']/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s])); 
}

// UI wiring
addCategoryBtn.addEventListener('click', ()=>{ 
  const name = categoryInput.value.trim(); 
  if(!name) return alert('Category name required'); 
  addCategory(name); 
  categoryInput.value=''; 
});

addTaskBtn.addEventListener('click', ()=>{ 
  const title = taskInput.value.trim(); 
  const cat = categorySelect.value || (state.categories[0] && state.categories[0].id); 
  if(!title) return alert('Task title required'); 
  addTask(title, cat); 
  taskInput.value=''; 
});

searchInput.addEventListener('input', e=>{ 
  state.filter.search = e.target.value; 
  render(); 
});

statusFilter.addEventListener('change', e=>{ 
  state.filter.status = e.target.value; 
  render(); 
});

sortSelect.addEventListener('change', e=>{ 
  state.filter.sort = e.target.value; 
  render(); 
});

clearCompleted.addEventListener('click', ()=>{ 
  state.tasks = state.tasks.filter(t=>!t.done); 
  save(); 
});

addSample.addEventListener('click', ()=>{ 
  seed(); 
  save(); 
});

taskInput.addEventListener('keydown', e=>{ 
  if(e.key==='Enter'){ addTaskBtn.click(); } 
});
categoryInput.addEventListener('keydown', e=>{ 
  if(e.key==='Enter'){ addCategoryBtn.click(); } 
});

// initial load
load(); 
seed(); 
render();
