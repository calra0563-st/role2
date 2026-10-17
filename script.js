/**
 * 우리 반 1인 1역할 배정기 - script.js
 * 역할 랜덤 매칭, A4 인쇄, 구글 스프레드시트(Apps Script) 연동 지원
 */

// ==========================================
// 1. 기본 예시 데이터 (학생 12명 & 역할 12개)
// ==========================================
const DEFAULT_STUDENTS = [
  '김민준', '이서아', '박도윤', '최하은',
  '정시우', '강지유', '조예준', '윤채원',
  '장서준', '임수아', '한우진', '오다은'
];

const DEFAULT_ROLES = [
  {
    name: '칠판 도우미',
    emoji: '🧹',
    desc: '수업 후 칠판을 깨끗하게 지우고 분필과 지우개를 정리해요.'
  },
  {
    name: '급식 도우미',
    emoji: '🍱',
    desc: '급식 시간 줄서기를 돕고 식탁을 단정하게 정돈해요.'
  },
  {
    name: '우유 도우미',
    emoji: '🥛',
    desc: '아침 우유를 친구들에게 배부하고 우유 상자를 반납해요.'
  },
  {
    name: '에너지 지킴이',
    emoji: '💡',
    desc: '쉬는 시간과 이동 수업 때 교실 전등과 모니터를 꺼요.'
  },
  {
    name: '분리수거 대장',
    emoji: '♻️',
    desc: '교실 쓰레기통과 재활용품이 바르게 버려지도록 도와요.'
  },
  {
    name: '도서 도우미',
    emoji: '📚',
    desc: '학급문고 책을 번호대로 꽂고 가지런하게 정리해요.'
  },
  {
    name: '창문·환기 요정',
    emoji: '🪟',
    desc: '아침과 점심시간 교실 창문을 열어 맑은 공기로 환기해요.'
  },
  {
    name: '줄서기 반장',
    emoji: '🚶',
    desc: '체육관이나 특별실 이동 시 친구들이 바르게 걷도록 이끌어요.'
  },
  {
    name: '식물 집사',
    emoji: '🌱',
    desc: '교실 화분의 식물들이 시들지 않게 사랑을 담아 물을 줘요.'
  },
  {
    name: '위생 지킴이',
    emoji: '🧴',
    desc: '손소독제와 물티슈를 관리하고 교실 청결을 살펴요.'
  },
  {
    name: '방송·음악 DJ',
    emoji: '🎵',
    desc: '아침 자습 시간이나 청소 시간에 밝고 신나는 음악을 틀어요.'
  },
  {
    name: '체육·놀이 부장',
    emoji: '⚽',
    desc: '체육 시간 공과 운동 교구를 챙기고 정리해요.'
  }
];

const THEMES = ['mint', 'yellow', 'pink', 'blue', 'purple', 'coral'];

// ==========================================
// 2. 앱 상태 관리 (State)
// ==========================================
const AppState = {
  className: localStorage.getItem('class_name') || '3학년 2반',
  students: JSON.parse(localStorage.getItem('class_students')) || [...DEFAULT_STUDENTS],
  roles: JSON.parse(localStorage.getItem('class_roles')) || [...DEFAULT_ROLES],
  assignments: JSON.parse(localStorage.getItem('class_assignments')) || null,
  assignedDate: localStorage.getItem('class_assigned_date') || null,
  sheetUrl: localStorage.getItem('class_sheet_url') || '',
  isShuffling: false,
};

// ==========================================
// 3. Web Audio 효과음 (Synthesizer Chime)
// ==========================================
function playChime(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'roll') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    }
  } catch {
    // AudioContext blocked by user gesture policy or unsupported
  }
}

// ==========================================
// 4. 무작위 배정 로직 (Fisher-Yates Shuffle)
// ==========================================
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignRoles() {
  if (AppState.isShuffling) return;
  AppState.isShuffling = true;

  const btnRoll = document.getElementById('btnRoll');
  if (btnRoll) {
    btnRoll.classList.add('is-shuffling');
    btnRoll.disabled = true;
  }

  playChime('roll');

  const cardsGrid = document.getElementById('cardsGrid');
  const emptyState = document.getElementById('emptyState');
  if (emptyState) emptyState.style.display = 'none';
  if (cardsGrid) cardsGrid.style.display = 'grid';

  // 롤링 애니메이션 효과 (0.6초간 무작위 셔플 시각화)
  let count = 0;
  const interval = setInterval(() => {
    count++;
    playChime('roll');
    renderRollingEffect();
    if (count > 5) {
      clearInterval(interval);
      finalizeAssignment();
    }
  }, 100);
}

function renderRollingEffect() {
  const cardsGrid = document.getElementById('cardsGrid');
  if (!cardsGrid) return;

  const tempRoles = shuffleArray(AppState.roles);
  cardsGrid.innerHTML = AppState.students.map((student, idx) => {
    const role = tempRoles[idx % tempRoles.length];
    const theme = THEMES[idx % THEMES.length];
    return `
      <div class="role-card" data-theme="${theme}" style="opacity: 0.75; transform: scale(0.98);">
        <div class="card-header">
          <div class="student-badge">
            <div class="student-avatar">${student.charAt(0)}</div>
            <div>
              <div class="student-id">No. ${String(idx + 1).padStart(2, '0')}</div>
              <div class="student-name">${student}</div>
            </div>
          </div>
          <span class="card-order-tag">🎲 셔플 중...</span>
        </div>
        <div class="card-role-box">
          <div class="role-title-row">
            <span class="role-emoji">${role.emoji}</span>
            <span class="role-name">${role.name}</span>
          </div>
          <p class="role-desc">${role.desc}</p>
        </div>
      </div>
    `;
  }).join('');
}

function finalizeAssignment() {
  const shuffledRoles = shuffleArray(AppState.roles);

  // 1:1 매칭 결과 생성
  const assignments = AppState.students.map((student, idx) => {
    const role = shuffledRoles[idx % shuffledRoles.length];
    return {
      studentId: idx + 1,
      studentName: student,
      roleName: role.name,
      roleEmoji: role.emoji,
      roleDesc: role.desc,
      theme: THEMES[idx % THEMES.length],
    };
  });

  const now = new Date();
  const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;

  AppState.assignments = assignments;
  AppState.assignedDate = dateStr;
  AppState.isShuffling = false;

  // LocalStorage 저장
  localStorage.setItem('class_assignments', JSON.stringify(assignments));
  localStorage.setItem('class_assigned_date', dateStr);

  const btnRoll = document.getElementById('btnRoll');
  if (btnRoll) {
    btnRoll.classList.remove('is-shuffling');
    btnRoll.disabled = false;
  }

  // 화면 렌더링 & A4 인쇄용 데이터 동기화
  renderAssignments();
  syncPrintBoard();
  playChime('success');
  triggerConfetti();
  showToast('🎉 1인 1역할 배정이 완료되었습니다!');
}

// ==========================================
// 5. 화면 렌더링 (Card Grid UI)
// ==========================================
function renderAssignments() {
  const cardsGrid = document.getElementById('cardsGrid');
  const emptyState = document.getElementById('emptyState');
  const statusBadge = document.getElementById('statusBadge');
  const assignedDateSpan = document.getElementById('assignedDateSpan');

  if (!AppState.assignments || AppState.assignments.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    if (cardsGrid) {
      cardsGrid.style.display = 'none';
      cardsGrid.innerHTML = '';
    }
    if (statusBadge) {
      statusBadge.textContent = '● 배정 대기 중';
      statusBadge.className = 'status-pill status-ready';
    }
    if (assignedDateSpan) {
      assignedDateSpan.textContent = '배정 전';
    }
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (cardsGrid) {
    cardsGrid.style.display = 'grid';
    cardsGrid.innerHTML = AppState.assignments.map((item, idx) => `
      <div class="role-card card-pop" data-theme="${item.theme}" style="animation-delay: ${idx * 40}ms">
        <div class="card-header">
          <div class="student-badge">
            <div class="student-avatar">${item.studentName.charAt(0)}</div>
            <div>
              <div class="student-id">No. ${String(item.studentId).padStart(2, '0')}</div>
              <div class="student-name">${item.studentName}</div>
            </div>
          </div>
          <span class="card-order-tag">역할 ${String(idx + 1).padStart(2, '0')}</span>
        </div>
        <div class="card-role-box">
          <div class="role-title-row">
            <span class="role-emoji">${item.roleEmoji}</span>
            <span class="role-name">${item.roleName}</span>
          </div>
          <p class="role-desc">${item.roleDesc}</p>
        </div>
      </div>
    `).join('');
  }

  if (statusBadge) {
    statusBadge.textContent = '✓ 배정 완료';
    statusBadge.className = 'status-pill status-complete';
  }

  if (assignedDateSpan) {
    assignedDateSpan.textContent = AppState.assignedDate || '오늘';
  }

  updateStatsRibbon();
}

function updateStatsRibbon() {
  const statStudents = document.getElementById('statStudents');
  const statRoles = document.getElementById('statRoles');
  if (statStudents) statStudents.textContent = `${AppState.students.length}명`;
  if (statRoles) statRoles.textContent = `${AppState.roles.length}개`;
}

// ==========================================
// 6. 교실 게시판 부착용 A4 인쇄 동기화
// ==========================================
function syncPrintBoard() {
  const printTitle = document.getElementById('printTitle');
  const printClassInfo = document.getElementById('printClassInfo');
  const printDateInfo = document.getElementById('printDateInfo');
  const printGrid = document.getElementById('printGrid');

  if (printTitle) {
    printTitle.textContent = `🏫 ${AppState.className} 1인 1역할 배정표`;
  }
  if (printClassInfo) {
    printClassInfo.textContent = `학급: ${AppState.className} (총 ${AppState.students.length}명)`;
  }
  if (printDateInfo) {
    printDateInfo.textContent = `배정일자: ${AppState.assignedDate || '미정'}`;
  }

  if (printGrid && AppState.assignments) {
    printGrid.innerHTML = AppState.assignments.map(item => `
      <div class="print-card-item">
        <div class="print-card-top">
          <span class="print-student-name">${item.studentName}</span>
          <span class="print-student-num">${String(item.studentId).padStart(2, '0')}번</span>
        </div>
        <div>
          <div class="print-role-title">
            <span>${item.roleEmoji}</span>
            <span>${item.roleName}</span>
          </div>
          <div class="print-role-desc">${item.roleDesc}</div>
        </div>
      </div>
    `).join('');
  }
}

function handlePrint() {
  if (!AppState.assignments || AppState.assignments.length === 0) {
    showToast('⚠️ 먼저 [🎲 역할 배정하기]를 눌러 배정을 완료해 주세요.');
    return;
  }
  syncPrintBoard();
  window.print();
}

// ==========================================
// 7. 구글 스프레드시트(Apps Script) 연동 및 정규화
// ==========================================

// 구글 스프레드시트에서 가져온 학생 데이터 안전 정규화 (1D/2D 배열, 객체 지원)
function normalizeStudents(rawStudents) {
  if (!rawStudents) return [];
  if (typeof rawStudents === 'string') {
    return rawStudents.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(rawStudents)) return [];
  return rawStudents.map(item => {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    if (Array.isArray(item)) return String(item[0] || '').trim();
    if (typeof item === 'object') {
      return String(item.name || item.studentName || item.student || item.이름 || item.학생 || Object.values(item)[0] || '').trim();
    }
    return String(item).trim();
  }).filter(Boolean);
}

// 구글 스프레드시트에서 가져온 역할 데이터 안전 정규화 (이름, 이모지, 설명 누락 방지)
function normalizeRoles(rawRoles) {
  if (!rawRoles) return [];
  if (!Array.isArray(rawRoles)) return [];
  return rawRoles.map((item, idx) => {
    if (!item) return null;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      return {
        name: trimmed,
        emoji: '⭐',
        desc: `${trimmed} 역할을 성실하게 수행해요.`
      };
    }
    if (Array.isArray(item)) {
      const name = String(item[0] || '').trim();
      if (!name) return null;
      return {
        name,
        emoji: String(item[1] || '⭐').trim() || '⭐',
        desc: String(item[2] || `${name} 역할을 성실하게 수행해요.`).trim()
      };
    }
    if (typeof item === 'object') {
      const name = String(item.name || item.roleName || item.역할 || item.역할명 || item.title || Object.values(item)[0] || '').trim();
      if (!name) return null;
      return {
        name,
        emoji: String(item.emoji || item.roleEmoji || item.아이콘 || item.icon || '⭐').trim() || '⭐',
        desc: String(item.desc || item.roleDesc || item.설명 || item.description || `${name} 역할을 성실하게 수행해요.`).trim()
      };
    }
    return null;
  }).filter(Boolean);
}

function openSheetModal(actionType = 'load') {
  const modal = document.getElementById('sheetModal');
  const inputUrl = document.getElementById('sheetUrlInput');
  const modalActionTitle = document.getElementById('modalActionTitle');

  if (inputUrl) {
    inputUrl.value = AppState.sheetUrl;
  }
  if (modalActionTitle) {
    modalActionTitle.textContent = actionType === 'load' ? '🔄 구글 스프레드시트 불러오기' : '💾 구글 스프레드시트에 저장';
  }
  if (modal) {
    modal.classList.add('is-active');
  }
}

function closeSheetModal() {
  const modal = document.getElementById('sheetModal');
  if (modal) modal.classList.remove('is-active');
}

async function handleSheetLoad() {
  const inputUrl = document.getElementById('sheetUrlInput');
  const url = inputUrl ? inputUrl.value.trim() : AppState.sheetUrl;

  if (!url) {
    openSheetModal('load');
    showToast('💡 먼저 Google Apps Script 웹 앱 URL을 입력해 주세요.');
    return;
  }

  AppState.sheetUrl = url;
  localStorage.setItem('class_sheet_url', url);

  showToast('🔄 스프레드시트에서 데이터를 가져오는 중...');
  try {
    const res = await fetch(`${url}?action=getData&timestamp=${Date.now()}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const rawData = data.data || data;
    let loadedStudentsCount = 0;
    let loadedRolesCount = 0;

    // 1. 학생 명단 정규화 및 저장
    const rawStudents = rawData.students || rawData.studentList || rawData.학생명단;
    const normalizedStudents = normalizeStudents(rawStudents);
    if (normalizedStudents.length > 0) {
      AppState.students = normalizedStudents;
      localStorage.setItem('class_students', JSON.stringify(AppState.students));
      loadedStudentsCount = normalizedStudents.length;
    }

    // 2. 역할 명단 정규화 및 저장
    const rawRoles = rawData.roles || rawData.roleList || rawData.역할명단;
    const normalizedRoles = normalizeRoles(rawRoles);
    if (normalizedRoles.length > 0) {
      AppState.roles = normalizedRoles;
      localStorage.setItem('class_roles', JSON.stringify(AppState.roles));
      loadedRolesCount = normalizedRoles.length;
    }

    // 3. 학급명 업데이트
    const className = rawData.className || rawData.학급명 || rawData.title;
    if (className) {
      AppState.className = String(className).trim();
      localStorage.setItem('class_name', AppState.className);
      const nameInput = document.getElementById('classNameInput');
      if (nameInput) nameInput.value = AppState.className;
    }

    // 4. 명단 관리 모달 내부 텍스트 영역 및 역할 목록 즉시 동기화
    const studentTextarea = document.getElementById('studentTextarea');
    if (studentTextarea) {
      studentTextarea.value = AppState.students.join('\n');
    }
    const studentCountBadge = document.getElementById('modalStudentCount');
    if (studentCountBadge) {
      studentCountBadge.textContent = `(${AppState.students.length}명)`;
    }
    renderManageRoleList();

    // 5. 새 명단 반영에 따라 기존 배정 상태 초기화 (새 명단으로 🎲 배정할 수 있도록 준비)
    AppState.assignments = null;
    AppState.assignedDate = null;
    localStorage.removeItem('class_assignments');
    localStorage.removeItem('class_assigned_date');

    // 6. 메인 화면 통계 및 배정 영역 리프레시
    updateStatsRibbon();
    renderAssignments();
    syncPrintBoard();

    closeSheetModal();
    showToast(`✅ 시트 연동 성공! 학생 ${loadedStudentsCount || AppState.students.length}명, 역할 ${loadedRolesCount || AppState.roles.length}개가 명단에 반영되었습니다!`);
  } catch (err) {
    console.error('Sheet load error:', err);
    showToast('⚠️ 연결에 실패했습니다. Apps Script 배포 URL과 웹앱 권한(모든 사용자)을 확인해 주세요.');
  }
}

async function handleSheetSave() {
  if (!AppState.assignments || AppState.assignments.length === 0) {
    showToast('⚠️ 저장할 배정 결과가 없습니다. 먼저 배정을 진행해 주세요.');
    return;
  }

  const inputUrl = document.getElementById('sheetUrlInput');
  const url = inputUrl ? inputUrl.value.trim() : AppState.sheetUrl;

  if (!url) {
    openSheetModal('save');
    return;
  }

  AppState.sheetUrl = url;
  localStorage.setItem('class_sheet_url', url);

  showToast('💾 스프레드시트에 저장하는 중...');
  try {
    const payload = {
      action: 'saveAssignments',
      className: AppState.className,
      assignedDate: AppState.assignedDate,
      assignments: AppState.assignments,
    };

    // Apps Script 웹앱으로 POST 전송
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script redirect 호환
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    closeSheetModal();
    showToast('✅ 구글 스프레드시트에 배정 결과가 전송되었습니다!');
  } catch (err) {
    showToast('⚠️ 저장 중 오류가 발생했습니다: ' + err.message);
  }
}

function copyAppsScriptCode() {
  const code = `// Google Apps Script (Code.gs) 코드
function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "getData") {
    var studentSheet = ss.getSheetByName("학생명단") || ss.getSheets()[0];
    var roleSheet = ss.getSheetByName("역할명단") || ss.getSheets()[1];
    
    var students = studentSheet.getRange(2, 1, studentSheet.getLastRow() - 1, 1).getValues().flat().filter(String);
    var rolesData = roleSheet.getRange(2, 1, roleSheet.getLastRow() - 1, 3).getValues();
    var roles = rolesData.map(function(row) {
      return { name: row[0], emoji: row[1] || "✨", desc: row[2] || "" };
    }).filter(function(r) { return r.name; });

    var result = { students: students, roles: roles, className: ss.getName() };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("OK");
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("배정결과") || ss.insertSheet("배정결과");
  
  sheet.clear();
  sheet.appendRow(["번호", "학생 이름", "배정 역할", "역할 아이콘", "역할 설명", "배정일자", "학급"]);
  
  data.assignments.forEach(function(item) {
    sheet.appendRow([item.studentId, item.studentName, item.roleName, item.roleEmoji, item.roleDesc, data.assignedDate, data.className]);
  });
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
}`;

  navigator.clipboard.writeText(code).then(() => {
    showToast('📋 Apps Script 코드가 클립보드에 복사되었습니다!');
  }).catch(() => {
    showToast('⚠️ 클립보드 복사에 실패했습니다.');
  });
}

function exportCsvBackup() {
  if (!AppState.assignments || AppState.assignments.length === 0) {
    showToast('⚠️ 내보낼 배정 결과가 없습니다.');
    return;
  }

  let csvContent = '\uFEFF번호,학생 이름,배정 역할,역할 설명,배정일자,학급\n';
  AppState.assignments.forEach(a => {
    csvContent += `"${a.studentId}","${a.studentName}","${a.roleEmoji} ${a.roleName}","${a.roleDesc}","${AppState.assignedDate}","${AppState.className}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${AppState.className}_1인1역할배정결과_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  showToast('📥 CSV 백업 파일이 다운로드되었습니다.');
}

// ==========================================
// 8. 명단 및 역할 관리 모달
// ==========================================
function openManageModal() {
  const modal = document.getElementById('manageModal');
  const studentTextarea = document.getElementById('studentTextarea');
  const studentCountBadge = document.getElementById('modalStudentCount');
  const roleCountBadge = document.getElementById('modalRoleCount');

  // 최신 AppState 명단으로 textarea와 배지 갱신
  if (studentTextarea) {
    studentTextarea.value = AppState.students.join('\n');
  }
  if (studentCountBadge) {
    studentCountBadge.textContent = `(${AppState.students.length}명)`;
  }
  if (roleCountBadge) {
    roleCountBadge.textContent = `(총 ${AppState.roles.length}개)`;
  }

  renderManageRoleList();
  if (modal) modal.classList.add('is-active');
}

function closeManageModal() {
  const modal = document.getElementById('manageModal');
  if (modal) modal.classList.remove('is-active');
}

function renderManageRoleList() {
  const roleListBox = document.getElementById('manageRoleListBox');
  const modalRoleCount = document.getElementById('modalRoleCount');
  if (modalRoleCount) modalRoleCount.textContent = `(총 ${AppState.roles.length}개)`;

  if (roleListBox) {
    roleListBox.innerHTML = AppState.roles.map((r, i) => {
      const name = r.name || '역할';
      const emoji = r.emoji || '⭐';
      const desc = r.desc || `${name} 역할을 성실하게 수행해요.`;
      const shortDesc = desc.length > 20 ? desc.slice(0, 18) + '...' : desc;
      return `
        <div class="list-preview-item">
          <span><strong>${i + 1}.</strong> ${emoji} ${name}</span>
          <span style="color: #64748B; font-size: 0.75rem;" title="${desc}">${shortDesc}</span>
        </div>
      `;
    }).join('');
  }
}

function saveManagedList() {
  const studentTextarea = document.getElementById('studentTextarea');
  if (studentTextarea) {
    const lines = normalizeStudents(studentTextarea.value);

    if (lines.length === 0) {
      showToast('⚠️ 학생 명단을 최소 1명 이상 입력해 주세요.');
      return;
    }

    AppState.students = lines;
    localStorage.setItem('class_students', JSON.stringify(AppState.students));
  }

  // 학생 명단이 변경되었으므로 기존 배정 상태 초기화하여 새로 배정할 수 있게 준비
  AppState.assignments = null;
  AppState.assignedDate = null;
  localStorage.removeItem('class_assignments');
  localStorage.removeItem('class_assigned_date');

  updateStatsRibbon();
  renderAssignments();
  syncPrintBoard();
  closeManageModal();
  showToast(`✅ 학생 명단(${AppState.students.length}명)이 저장되었습니다! [🎲 배정하기]를 눌러주세요.`);
}

function resetToDefault() {
  if (confirm('기본 예시 데이터(학생 12명, 역할 12개)로 초기화할까요?')) {
    AppState.students = [...DEFAULT_STUDENTS];
    AppState.roles = [...DEFAULT_ROLES];
    localStorage.setItem('class_students', JSON.stringify(AppState.students));
    localStorage.setItem('class_roles', JSON.stringify(AppState.roles));

    const studentTextarea = document.getElementById('studentTextarea');
    if (studentTextarea) studentTextarea.value = AppState.students.join('\n');
    renderManageRoleList();
    updateStatsRibbon();
    showToast('🔄 기본 12명/12개 데이터로 초기화되었습니다.');
  }
}

// ==========================================
// 9. Confetti 축하 효과 (Pure Canvas)
// ==========================================
function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#FF5A00', '#FFB800', '#0088FF', '#00BA88', '#FF3D00', '#8C4BFF', '#FFD2BC'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 - 50,
      r: Math.random() * 6 + 3,
      dx: (Math.random() - 0.5) * 16,
      dy: (Math.random() - 0.7) * 16,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10,
      tiltSpeed: Math.random() * 0.1 + 0.05,
      alpha: 1,
      decay: Math.random() * 0.012 + 0.008
    });
  }

  let animationFrame;
  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.35; // gravity
      p.alpha -= p.decay;
      p.tilt += p.tiltSpeed;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(p.alpha, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    if (alive) {
      animationFrame = requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  update();
}

// ==========================================
// 10. 토스트 알림창
// ==========================================
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ==========================================
// 11. 초기화 및 이벤트 바인딩
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 학급명 바인딩
  const classNameInput = document.getElementById('classNameInput');
  if (classNameInput) {
    classNameInput.value = AppState.className;
    classNameInput.addEventListener('input', (e) => {
      AppState.className = e.target.value || '우리 반';
      localStorage.setItem('class_name', AppState.className);
      syncPrintBoard();
    });
  }

  // 상단 버튼 바인딩
  const btnSheetLoad = document.getElementById('btnSheetLoad');
  const btnSheetSave = document.getElementById('btnSheetSave');
  const btnManage = document.getElementById('btnManage');
  const btnPrint = document.getElementById('btnPrint');
  const btnRoll = document.getElementById('btnRoll');

  if (btnSheetLoad) btnSheetLoad.addEventListener('click', () => {
    if (AppState.sheetUrl) {
      handleSheetLoad();
    } else {
      openSheetModal('load');
    }
  });
  if (btnSheetSave) btnSheetSave.addEventListener('click', () => {
    if (!AppState.sheetUrl) {
      openSheetModal('save');
    } else {
      handleSheetSave();
    }
  });
  if (btnManage) btnManage.addEventListener('click', openManageModal);
  if (btnPrint) btnPrint.addEventListener('click', handlePrint);
  if (btnRoll) btnRoll.addEventListener('click', assignRoles);

  // 시트 모달 버튼 바인딩
  const btnCloseSheetModal = document.getElementById('btnCloseSheetModal');
  const btnFetchSheetNow = document.getElementById('btnFetchSheetNow');
  const btnSaveSheetUrl = document.getElementById('btnSaveSheetUrl');
  const btnCopyScript = document.getElementById('btnCopyScript');
  const btnExportCsv = document.getElementById('btnExportCsv');

  if (btnCloseSheetModal) btnCloseSheetModal.addEventListener('click', closeSheetModal);
  if (btnFetchSheetNow) btnFetchSheetNow.addEventListener('click', handleSheetLoad);
  if (btnSaveSheetUrl) {
    btnSaveSheetUrl.addEventListener('click', () => {
      const urlInput = document.getElementById('sheetUrlInput');
      if (urlInput) {
        AppState.sheetUrl = urlInput.value.trim();
        localStorage.setItem('class_sheet_url', AppState.sheetUrl);
        showToast('🔗 스프레드시트 Web App URL이 저장되었습니다!');
      }
    });
  }
  if (btnCopyScript) btnCopyScript.addEventListener('click', copyAppsScriptCode);
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsvBackup);

  // 명단 관리 모달 버튼 바인딩
  const btnCloseManageModal = document.getElementById('btnCloseManageModal');
  const btnSaveManage = document.getElementById('btnSaveManage');
  const btnResetDefault = document.getElementById('btnResetDefault');

  if (btnCloseManageModal) btnCloseManageModal.addEventListener('click', closeManageModal);
  if (btnSaveManage) btnSaveManage.addEventListener('click', saveManagedList);
  if (btnResetDefault) btnResetDefault.addEventListener('click', resetToDefault);

  // 모달 배경 클릭 시 닫기
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m) {
        m.classList.remove('is-active');
      }
    });
  });

  // 초기 렌더링
  updateStatsRibbon();
  renderAssignments();
  syncPrintBoard();
});
