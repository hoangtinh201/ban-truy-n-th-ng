/*============================================
  BAN TRUYỀN THÔNG - MAIN APPLICATION
  Version: 1.0.0
  Author: Ban Truyền Thông
============================================*/

// ============================================
// 1. GLOBAL STATE & VARIABLES
// ============================================

const APP_STATE = {
    currentUser: null,
    config: null,
    darkMode: false,
    sidebarCollapsed: false,
    currentTab: 'dashboard',

    // Data
    users: [],
    members: [],
    works: [],
    content: [],
    media: [],
    auditLog: [],

    // Verification codes
    verificationCode: '',
    resetEmail: '',

    // Filters
    filters: {
        workMonth: '',
        workYear: '',
        workStatus: '',
        mediaYear: '',
        mediaMonth: '',
        contentYear: '',
        contentMonth: '',
        contentType: ''
    }
};

// ============================================
// 2. UTILITY FUNCTIONS
// ============================================

function hideLoadingScreen() {
    const loader = document.querySelector('.loading-screen');
    if (loader) {
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

function showMessage(text, type = 'info', duration = 5000) {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    container.textContent = text;
    container.className = `message ${type} show`;

    setTimeout(() => {
        container.classList.remove('show');
    }, duration);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function generateYears(startYear = 2024, count = 7) {
    const years = [];
    for (let i = 0; i < count; i++) {
        years.push(startYear + i);
    }
    return years;
}

function getStatusBadgeClass(status) {
    const map = {
        'pending': 'badge-pending',
        'inprogress': 'badge-inprogress',
        'completed': 'badge-completed',
        'cancelled': 'badge-cancelled'
    };
    return map[status] || 'badge-pending';
}

function getStatusText(status) {
    const map = {
        'pending': '⏳ Chờ thực hiện',
        'inprogress': '⚙️ Đang thực hiện',
        'completed': '✅ Hoàn thành',
        'cancelled': '❌ Hủy bỏ'
    };
    return map[status] || status;
}

// ============================================
// 3. DATABASE FUNCTIONS (localStorage)
// ============================================

function dbGet(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('DB Get error:', error);
        return null;
    }
}

function dbSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('DB Set error:', error);
        return false;
    }
}

function dbAdd(key, item) {
    try {
        const data = dbGet(key) || { [key]: [] };
        const items = data[key] || [];
        item.id = Date.now();
        items.push(item);
        data[key] = items;
        dbSet(key, data);
        return item;
    } catch (error) {
        console.error('DB Add error:', error);
        return null;
    }
}

function dbUpdate(key, id, updates) {
    try {
        const data = dbGet(key) || { [key]: [] };
        const items = data[key] || [];
        const index = items.findIndex(item => item.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updates };
            data[key] = items;
            dbSet(key, data);
            return items[index];
        }
        return null;
    } catch (error) {
        console.error('DB Update error:', error);
        return null;
    }
}

function dbDelete(key, id) {
    try {
        const data = dbGet(key) || { [key]: [] };
        const items = data[key] || [];
        data[key] = items.filter(item => item.id !== id);
        dbSet(key, data);
        return true;
    } catch (error) {
        console.error('DB Delete error:', error);
        return false;
    }
}

// ============================================
// 4. AUTHENTICATION
// ============================================

async function login(username, password) {
    try {
        const users = APP_STATE.users;
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            APP_STATE.currentUser = user;

            // Update last login
            user.lastLogin = new Date().toISOString();
            const usersData = { users: users };
            dbSet('users', usersData);

            // Save session
            localStorage.setItem('currentUser', JSON.stringify(user));

            // Log audit
            addAuditLog('Đăng nhập', `${user.username} đã đăng nhập vào hệ thống`);

            return user;
        }

        return null;
    } catch (error) {
        console.error('Login error:', error);
        return null;
    }
}

function logout() {
    if (APP_STATE.currentUser) {
        addAuditLog('Đăng xuất', `${APP_STATE.currentUser.username} đã đăng xuất`);
    }

    APP_STATE.currentUser = null;
    localStorage.removeItem('currentUser');

    // Hide main app, show login
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
}

function checkAuth() {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        APP_STATE.currentUser = JSON.parse(saved);
        return true;
    }
    return false;
}

function getUserRole() {
    return APP_STATE.currentUser?.role || 'user';
}

function hasPermission(permission) {
    const role = getUserRole();
    if (role === 'truongBan') return true;
    if (role === 'phoBan') {
        const allowedPerms = ['manageStaff', 'assignWork', 'approveContent', 'updateProgress', 'uploadDocs', 'viewCalendar'];
        return allowedPerms.includes(permission);
    }
    return ['updateProgress', 'viewCalendar'].includes(permission);
}

// ============================================
// 5. AUDIT LOG
// ============================================

function addAuditLog(action, description) {
    try {
        const logs = APP_STATE.auditLog || [];
        logs.unshift({
            id: Date.now(),
            action: action,
            description: description,
            username: APP_STATE.currentUser?.username || 'System',
            createdAt: new Date().toISOString()
        });

        // Keep only last 100 logs
        if (logs.length > 100) logs.pop();

        APP_STATE.auditLog = logs;
        const auditData = { audit_log: logs };
        dbSet('audit_log', auditData);
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

async function loadAuditLog() {
    try {
        const container = document.getElementById('auditLog');
        if (!container) return;

        const logs = APP_STATE.auditLog || [];

        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="icon">📜</i>
                    <h3>Chưa có lịch sử</h3>
                    <p>Các hoạt động sẽ được ghi lại tại đây</p>
                </div>
            `;
            return;
        }

        let html = '';
        logs.slice(0, 50).forEach(log => {
            const date = new Date(log.createdAt);
            html += `
                <div class="work-item">
                    <h4>${log.action}</h4>
                    <p style="color: var(--text-gray); margin-top: 8px; font-size: 14px;">${log.description}</p>
                    <p style="color: var(--text-gray); font-size: 12px; margin-top: 5px;">
                        ${log.username} • ${date.toLocaleString('vi-VN')}
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Load audit log error:', error);
    }
}

// ============================================
// 6. WORKS MANAGEMENT
// ============================================

async function loadWorks() {
    try {
        const container = document.getElementById('workList');
        if (!container) return;

        let works = APP_STATE.works || [];

        // Apply filters
        const month = document.getElementById('filterWorkMonth')?.value;
        const year = document.getElementById('filterWorkYear')?.value;
        const status = document.getElementById('filterWorkStatus')?.value;

        if (month) {
            works = works.filter(w => new Date(w.deadline).getMonth() + 1 == month);
        }
        if (year) {
            works = works.filter(w => new Date(w.deadline).getFullYear() == year);
        }
        if (status) {
            works = works.filter(w => w.status === status);
        }

        // Sort by deadline
        works.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        if (works.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="icon">📋</i>
                    <h3>Chưa có công việc</h3>
                    <p>Thêm công việc mới để bắt đầu</p>
                    ${hasPermission('assignWork') ? '<button class="btn btn-primary" onclick="openAddWorkModal()">+ Thêm công việc</button>' : ''}
                </div>
            `;
            return;
        }

        let html = '';
        works.forEach(work => {
            const canEdit = hasPermission('assignWork');
            const priorityColor = work.priority === 'high' ? 'style="color: var(--danger);"' : '';

            html += `
                <div class="work-item" ${priorityColor}>
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4>${work.name}</h4>
                            <p style="margin-top: 10px; color: var(--text-gray); font-size: 13px;">
                                <span>📌 ${work.type}</span>
                                <span style="margin-left: 15px;">📅 Giao: ${formatDate(work.assign_date)}</span>
                                <span style="margin-left: 15px;">⏰ Deadline: ${formatDate(work.deadline)}</span>
                                ${work.time ? `<span style="margin-left: 15px;">🕐 ${work.time}</span>` : ''}
                            </p>
                            <p style="margin-top: 8px;">
                                <span class="badge ${getStatusBadgeClass(work.status)}">${getStatusText(work.status)}</span>
                                ${work.assignee ? `<span style="margin-left: 10px; color: var(--text-gray);">👤 ${work.assignee}</span>` : ''}
                                ${work.priority === 'high' ? `<span style="margin-left: 10px; color: var(--danger); font-weight: 600;">⚠️ Ưu tiên cao</span>` : ''}
                            </p>
                            ${work.note ? `<p style="margin-top: 10px; color: var(--text-gray); font-style: italic; font-size: 13px;">${work.note}</p>` : ''}
                        </div>
                        ${canEdit ? `
                            <div style="display: flex; gap: 10px; margin-left: 20px;">
                                <button class="btn btn-sm btn-primary" onclick="editWork(${work.id})">Sửa</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteWork(${work.id})">Xóa</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Load works error:', error);
    }
}

function openAddWorkModal() {
    if (!hasPermission('assignWork')) {
        showMessage('❌ Bạn không có quyền thêm công việc', 'error');
        return;
    }

    document.getElementById('workForm').reset();
    document.getElementById('workId').value = '';
    document.getElementById('workModalTitle').textContent = 'Thêm công việc mới';

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('workAssignDate').value = today;

    document.getElementById('workModal').classList.add('active');
}

async function saveWork() {
    try {
        const id = document.getElementById('workId').value;
        const workData = {
            name: document.getElementById('workName').value,
            type: document.getElementById('workType').value,
            assign_date: document.getElementById('workAssignDate').value,
            deadline: document.getElementById('workDeadline').value,
            time: document.getElementById('workTime').value,
            assignee: document.getElementById('workAssignee').value,
            status: document.getElementById('workStatus').value,
            goal: document.getElementById('workGoal').value,
            note: document.getElementById('workNote').value,
            priority: 'medium',
            createdBy: APP_STATE.currentUser.username,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (id) {
            // Update
            const index = APP_STATE.works.findIndex(w => w.id == id);
            if (index !== -1) {
                APP_STATE.works[index] = { ...APP_STATE.works[index], ...workData };
                dbSet('works', { works: APP_STATE.works });
                addAuditLog('Cập nhật công việc', `Đã cập nhật: ${workData.name}`);
                showMessage('✅ Cập nhật công việc thành công', 'success');
            }
        } else {
            // Insert
            workData.id = Date.now();
            APP_STATE.works.push(workData);
            dbSet('works', { works: APP_STATE.works });
            addAuditLog('Tạo công việc', `Đã tạo: ${workData.name}`);
            showMessage('✅ Thêm công việc thành công', 'success');
        }

        closeModal('workModal');
        await loadWorks();
        await updateStats();
    } catch (error) {
        console.error('Save work error:', error);
        showMessage('❌ Có lỗi xảy ra', 'error');
    }
}

async function editWork(id) {
    try {
        const work = APP_STATE.works.find(w => w.id === id);
        if (!work) return;

        document.getElementById('workModalTitle').textContent = 'Chỉnh sửa công việc';
        document.getElementById('workId').value = work.id;
        document.getElementById('workName').value = work.name;
        document.getElementById('workType').value = work.type;
        document.getElementById('workAssignDate').value = work.assign_date;
        document.getElementById('workDeadline').value = work.deadline;
        document.getElementById('workTime').value = work.time || '';
        document.getElementById('workAssignee').value = work.assignee || '';
        document.getElementById('workStatus').value = work.status;
        document.getElementById('workGoal').value = work.goal || '';
        document.getElementById('workNote').value = work.note || '';

        document.getElementById('workModal').classList.add('active');
    } catch (error) {
        console.error('Edit work error:', error);
    }
}

async function deleteWork(id) {
    if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;

    try {
        const work = APP_STATE.works.find(w => w.id === id);
        APP_STATE.works = APP_STATE.works.filter(w => w.id !== id);
        dbSet('works', { works: APP_STATE.works });

        addAuditLog('Xóa công việc', `Đã xóa: ${work.name}`);
        showMessage('✅ Xóa công việc thành công', 'success');

        await loadWorks();
        await updateStats();
    } catch (error) {
        console.error('Delete work error:', error);
        showMessage('❌ Có lỗi xảy ra', 'error');
    }
}

function filterWorks() {
    loadWorks();
}

// ============================================
// 7. MEMBERS MANAGEMENT
// ============================================

async function loadMembers() {
    try {
        const container = document.getElementById('membersContainer');
        if (!container) return;

        const terms = APP_STATE.config?.settings?.terms || [];
        let html = '';

        terms.forEach(term => {
            const termMembers = APP_STATE.members.filter(m => m.term === term.id) || [];

            html += `
                <div class="card">
                    <div class="card-header">
                        <h3>${term.name}</h3>
                        <span style="color: var(--text-gray); font-size: 14px;">${termMembers.length} thành viên</span>
                    </div>
                    <div class="member-grid" id="members-${term.id}"></div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Render members for each term
        terms.forEach(term => {
            const termMembers = APP_STATE.members.filter(m => m.term === term.id) || [];
            const gridContainer = document.getElementById(`members-${term.id}`);

            if (termMembers.length === 0) {
                gridContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-gray); padding: 20px;">Chưa có thành viên</p>';
                return;
            }

            let membersHtml = '';
            termMembers.forEach(member => {
                const isAdmin = hasPermission('manageStaff');
                const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();

                membersHtml += `
                    <div class="member-card">
                        <div class="member-card-header">
                            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='%233b82f6'/%3E%3Ctext x='50' y='65' font-size='40' fill='white' text-anchor='middle' font-family='Arial'%3E${initials}%3C/text%3E%3C/svg%3E" alt="${member.name}" class="member-avatar">
                            <div>
                                <h4>${member.name}</h4>
                                <span class="badge badge-admin">${member.position}</span>
                            </div>
                        </div>
                        <div class="member-card-info">
                            ${member.email ? `<p>📧 ${member.email}</p>` : ''}
                            ${member.phone ? `<p>📱 ${member.phone}</p>` : ''}
                            ${member.birthday ? `<p>🎂 ${formatDate(member.birthday)}</p>` : ''}
                            ${member.gender ? `<p>👤 ${member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác'}</p>` : ''}
                            ${member.parish ? `<p>⛪ ${member.parish}</p>` : ''}
                        </div>
                        ${isAdmin ? `
                            <div class="member-card-actions">
                                <button class="btn btn-sm btn-primary" onclick="editMember(${member.id}, '${term.id}')">Sửa</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteMember(${member.id}, '${term.id}')">Xóa</button>
                            </div>
                        ` : ''}
                    </div>
                `;
            });

            gridContainer.innerHTML = membersHtml;
        });
    } catch (error) {
        console.error('Load members error:', error);
    }
}

function openAddMemberModal() {
    if (!hasPermission('manageStaff')) {
        showMessage('❌ Bạn không có quyền thêm thành viên', 'error');
        return;
    }

    document.getElementById('memberForm').reset();
    document.getElementById('memberId').value = '';
    document.getElementById('memberModalTitle').textContent = 'Thêm thành viên';
    document.getElementById('memberModal').classList.add('active');
}

async function saveMember() {
    try {
        const id = document.getElementById('memberId').value;
        const memberData = {
            name: document.getElementById('memberName').value,
            position: document.getElementById('memberPosition').value,
            email: document.getElementById('memberEmail').value,
            phone: document.getElementById('memberPhone').value,
            birthYear: parseInt(document.getElementById('memberBirthYear').value) || null,
            birthday: document.getElementById('memberBirthday').value,
            gender: document.getElementById('memberGender').value,
            parish: document.getElementById('memberParish').value,
            address: document.getElementById('memberAddress').value,
            term: document.getElementById('memberTerm').value,
            active: true
        };

        if (id) {
            // Update
            const index = APP_STATE.members.findIndex(m => m.id == id);
            if (index !== -1) {
                APP_STATE.members[index] = { ...APP_STATE.members[index], ...memberData };
                dbSet('members', { members: APP_STATE.members });
                addAuditLog('Cập nhật thành viên', `Đã cập nhật: ${memberData.name}`);
                showMessage('✅ Cập nhật thành viên thành công', 'success');
            }
        } else {
            // Insert
            memberData.id = Date.now();
            APP_STATE.members.push(memberData);
            dbSet('members', { members: APP_STATE.members });
            addAuditLog('Thêm thành viên', `Đã thêm: ${memberData.name}`);
            showMessage('✅ Thêm thành viên thành công', 'success');
        }

        closeModal('memberModal');
        await loadMembers();
        await updateStats();
    } catch (error) {
        console.error('Save member error:', error);
        showMessage('❌ Có lỗi xảy ra', 'error');
    }
}

async function editMember(id, term) {
    try {
        const member = APP_STATE.members.find(m => m.id === id);
        if (!member) return;

        document.getElementById('memberModalTitle').textContent = 'Chỉnh sửa thành viên';
        document.getElementById('memberId').value = member.id;
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberPosition').value = member.position;
        document.getElementById('memberEmail').value = member.email || '';
        document.getElementById('memberPhone').value = member.phone || '';
        document.getElementById('memberBirthYear').value = member.birthYear || '';
        document.getElementById('memberBirthday').value = member.birthday || '';
        document.getElementById('memberGender').value = member.gender || 'male';
        document.getElementById('memberParish').value = member.parish || '';
        document.getElementById('memberAddress').value = member.address || '';
        document.getElementById('memberTerm').value = member.term;

        document.getElementById('memberModal').classList.add('active');
    } catch (error) {
        console.error('Edit member error:', error);
    }
}

async function deleteMember(id, term) {
    if (!confirm('Bạn có chắc muốn xóa thành viên này?')) return;

    try {
        const member = APP_STATE.members.find(m => m.id === id);
        APP_STATE.members = APP_STATE.members.filter(m => m.id !== id);
        dbSet('members', { members: APP_STATE.members });

        addAuditLog('Xóa thành viên', `Đã xóa: ${member.name}`);
        showMessage('✅ Xóa thành viên thành công', 'success');

        await loadMembers();
        await updateStats();
    } catch (error) {
        console.error('Delete member error:', error);
        showMessage('❌ Có lỗi xảy ra', 'error');
    }
}

function filterMembers() {
    loadMembers();
}

// ============================================
// 8. STATISTICS
// ============================================

async function updateStats() {
    try {
        const works = APP_STATE.works || [];
        const members = APP_STATE.members || [];
        const media = APP_STATE.media || [];

        document.getElementById('statTotalWorks').textContent = works.length;
        document.getElementById('statCompletedWorks').textContent = works.filter(w => w.status === 'completed').length;
        document.getElementById('statMediaFiles').textContent = media.length;
        document.getElementById('statMembers').textContent = members.length;

        await loadRecentWorks();
        await checkUpcomingBirthdays();
    } catch (error) {
        console.error('Update stats error:', error);
    }
}

async function loadRecentWorks() {
    try {
        const works = APP_STATE.works || [];
        const container = document.getElementById('recentWorks');

        if (!works || works.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="icon">📋</i>
                    <h3>Chưa có công việc</h3>
                </div>
            `;
            return;
        }

        // Get latest 5 works
        const recent = [...works].reverse().slice(0, 5);

        let html = '';
        recent.forEach(work => {
            html += `
                <div class="work-item">
                    <h4>${work.name}</h4>
                    <p style="margin-top: 10px;">
                        <span class="badge ${getStatusBadgeClass(work.status)}">${getStatusText(work.status)}</span>
                        <span style="margin-left: 10px; color: var(--text-gray); font-size: 13px;">📅 ${formatDate(work.deadline)}</span>
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Load recent works error:', error);
    }
}

async function checkUpcomingBirthdays() {
    try {
        const members = APP_STATE.members || [];
        const container = document.getElementById('upcomingBirthdays');

        const today = new Date();
        const upcoming = members.filter(member => {
            if (!member.birthday) return false;
            const birthday = new Date(member.birthday);
            const thisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
            const daysUntil = Math.ceil((thisYear - today) / (1000 * 60 * 60 * 24));
            return daysUntil >= 0 && daysUntil <= 7;
        });

        if (upcoming.length === 0) {
            container.innerHTML = '<p style="color: var(--text-gray); text-align: center; padding: 20px;">Không có sinh nhật nào trong 7 ngày tới</p>';
            return;
        }

        let html = '';
        upcoming.forEach(member => {
            const birthday = new Date(member.birthday);
            const thisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
            const daysUntil = Math.ceil((thisYear - today) / (1000 * 60 * 60 * 24));

            html += `
                <div class="work-item" style="border-left-color: var(--accent-gold);">
                    <h4>🎂 Sinh nhật ${member.name}</h4>
                    <p style="color: var(--text-gray); margin-top: 5px; font-size: 13px;">
                        ${birthday.getDate()}/${birthday.getMonth() + 1} • ${member.position} •
                        ${daysUntil === 0 ? 'Hôm nay' : daysUntil === 1 ? 'Ngày mai' : `Còn ${daysUntil} ngày`}
                    </p>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Check birthdays error:', error);
    }
}

// ============================================
// 9. UI FUNCTIONS
// ============================================

function switchTab(tabName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) {
        tab.classList.add('active');
    }

    APP_STATE.currentTab = tabName;

    // Load data for specific tabs
    if (tabName === 'work') loadWorks();
    if (tabName === 'members') loadMembers();
    if (tabName === 'audit') loadAuditLog();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    APP_STATE.sidebarCollapsed = !APP_STATE.sidebarCollapsed;
}

function toggleTheme() {
    APP_STATE.darkMode = !APP_STATE.darkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('themeIcon').textContent = APP_STATE.darkMode ? '☀️' : '🌙';
    localStorage.setItem('darkMode', APP_STATE.darkMode);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function openNotifications() {
    showMessage('🔔 Không có thông báo mới', 'info');
}

function handleGlobalSearch() {
    const query = document.getElementById('globalSearch')?.value.toLowerCase();
    if (!query) return;

    const results = {
        works: APP_STATE.works.filter(w => w.name.toLowerCase().includes(query)),
        members: APP_STATE.members.filter(m => m.name.toLowerCase().includes(query)),
        content: APP_STATE.content.filter(c => c.title.toLowerCase().includes(query))
    };

    console.log('Search results:', results);
    showMessage(`Tìm thấy ${results.works.length + results.members.length + results.content.length} kết quả`, 'info');
}

// ============================================
// 10. LOGIN & PASSWORD RECOVERY
// ============================================

function showForgotPassword(e) {
    e.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'none';
    document.getElementById('forgotPasswordContainer').style.display = 'block';
    document.getElementById('verifyCodeContainer').style.display = 'none';
}

function showLogin(e) {
    e?.preventDefault();
    document.getElementById('loginFormContainer').style.display = 'block';
    document.getElementById('forgotPasswordContainer').style.display = 'none';
    document.getElementById('verifyCodeContainer').style.display = 'none';
}

function updateUserInfo() {
    if (!APP_STATE.currentUser) return;

    document.getElementById('currentUserName').textContent = APP_STATE.currentUser.username;

    const roleMap = {
        'truongBan': 'Trưởng Ban',
        'phoBan': 'Phó Ban',
        'user': 'Thành viên'
    };

    document.getElementById('currentUserRole').textContent = roleMap[APP_STATE.currentUser.role] || 'Thành viên';
}

function updatePermissions() {
    const canManage = hasPermission('assignWork');

    // Show/hide buttons
    const manageButtons = ['btnAddWork', 'btnAddMember', 'btnUploadMedia', 'btnAddContent', 'btnAddUser'];
    manageButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.style.display = canManage ? 'inline-flex' : 'none';
        }
    });

    // Hide admin-only nav items
    if (getUserRole() !== 'truongBan') {
        const navUsers = document.getElementById('navUsers');
        const navAudit = document.getElementById('navAudit');
        if (navUsers) navUsers.style.display = 'none';
        if (navAudit) navAudit.style.display = 'none';
    }
}

// ============================================
// 11. BACKUP & RESTORE
// ============================================

function backupData() {
    try {
        const backup = {
            timestamp: new Date().toISOString(),
            data: {
                users: APP_STATE.users,
                members: APP_STATE.members,
                works: APP_STATE.works,
                content: APP_STATE.content,
                media: APP_STATE.media,
                auditLog: APP_STATE.auditLog
            }
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        addAuditLog('Sao lưu dữ liệu', 'Đã thực hiện sao lưu dữ liệu');
        showMessage('✅ Sao lưu thành công', 'success');
    } catch (error) {
        console.error('Backup error:', error);
        showMessage('❌ Lỗi sao lưu', 'error');
    }
}

function restoreData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        try {
            const file = e.target.files[0];
            const text = await file.text();
            const backup = JSON.parse(text);

            if (backup.data) {
                APP_STATE.users = backup.data.users;
                APP_STATE.members = backup.data.members;
                APP_STATE.works = backup.data.works;
                APP_STATE.content = backup.data.content;
                APP_STATE.media = backup.data.media;
                APP_STATE.auditLog = backup.data.auditLog;

                dbSet('users', { users: APP_STATE.users });
                dbSet('members', { members: APP_STATE.members });
                dbSet('works', { works: APP_STATE.works });
                dbSet('content', { content: APP_STATE.content });
                dbSet('media', { media: APP_STATE.media });
                dbSet('audit_log', { audit_log: APP_STATE.auditLog });

                addAuditLog('Khôi phục dữ liệu', 'Đã khôi phục dữ liệu từ bản sao');
                showMessage('✅ Khôi phục thành công', 'success');

                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (error) {
            console.error('Restore error:', error);
            showMessage('❌ Lỗi khôi phục', 'error');
        }
    };
    input.click();
}

// ============================================
// 12. PLACEHOLDER FUNCTIONS
// ============================================

function openUploadMediaModal() {
    if (!hasPermission('uploadDocs')) {
        showMessage('❌ Bạn không có quyền tải tư liệu', 'error');
        return;
    }
    showMessage('⏳ Chức năng này đang phát triển', 'info');
}

function openAddContentModal() {
    if (!hasPermission('approveContent')) {
        showMessage('❌ Bạn không có quyền thêm content', 'error');
        return;
    }
    showMessage('⏳ Chức năng này đang phát triển', 'info');
}

function openAddUserModal() {
    if (!hasPermission('admin')) {
        showMessage('❌ Bạn không có quyền thêm tài khoản', 'error');
        return;
    }
    showMessage('⏳ Chức năng này đang phát triển', 'info');
}

function openProfileModal() {
    showMessage('⏳ Chức năng này đang phát triển', 'info');
}

function filterMedia() {}
function filterContent() {}

// ============================================
// 13. INITIALIZATION
// ============================================

async function initializeApp() {
    console.log('🚀 Initializing app...');

    try {
        // Load config
        await window.configLoader.loadAll();
        window.configLoader.applyTheme();
        window.configLoader.updateSiteInfo();

        APP_STATE.config = window.configLoader.config;

        // Load data into state
        const usersData = dbGet('users') || { users: [] };
        const membersData = dbGet('members') || { members: [] };
        const worksData = dbGet('works') || { works: [] };
        const contentData = dbGet('content') || { content: [] };
        const mediaData = dbGet('media') || { media: [] };
        const auditData = dbGet('audit_log') || { audit_log: [] };

        APP_STATE.users = usersData.users || [];
        APP_STATE.members = membersData.members || [];
        APP_STATE.works = worksData.works || [];
        APP_STATE.content = contentData.content || [];
        APP_STATE.media = mediaData.media || [];
        APP_STATE.auditLog = auditData.audit_log || [];

        // Populate dropdowns
        populateYearSelects();
        populateWorkTypes();
        populatePositions();
        populateTerms();

        // Check auth
        if (checkAuth()) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'flex';
            updateUserInfo();
            updatePermissions();
            await updateStats();
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        }

        // Load dark mode
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'true') {
            APP_STATE.darkMode = true;
            document.body.classList.add('dark-mode');
            document.getElementById('themeIcon').textContent = '☀️';
        }

        hideLoadingScreen();
        console.log('✅ App initialized');

    } catch (error) {
        console.error('Init error:', error);
        hideLoadingScreen();
        showMessage('❌ Lỗi khởi tạo ứng dụng', 'error');
    }
}

function populateYearSelects() {
    const years = window.configLoader.getYears();
    const yearSelects = ['filterWorkYear', 'filterMediaYear', 'filterContentYear'];

    yearSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Tất cả năm</option>';
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            select.appendChild(option);
        });
    });
}

function populateWorkTypes() {
    const types = APP_STATE.config?.settings?.workTypes || [];
    const select = document.getElementById('workType');
    if (!select) return;

    select.innerHTML = '<option value="">Chọn loại</option>';
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });
}

function populatePositions() {
    const positions = APP_STATE.config?.settings?.positions || [];
    const selects = ['memberPosition', 'workAssignee'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = '<option value="">Chọn chức vụ</option>';
        positions.forEach(position => {
            const option = document.createElement('option');
            option.value = position;
            option.textContent = position;
            select.appendChild(option);
        });
    });
}

function populateTerms() {
    const terms = APP_STATE.config?.settings?.terms || [];
    const selects = ['memberTerm', 'filterMemberTerm'];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;

        if (selectId === 'filterMemberTerm') {
            select.innerHTML = '<option value="">Tất cả nhiệm kỳ</option>';
        } else {
            select.innerHTML = '';
        }

        terms.forEach(term => {
            const option = document.createElement('option');
            option.value = term.id;
            option.textContent = term.name;
            select.appendChild(option);
        });
    });
}

// ============================================
// 14. EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 Page loaded');

    // Load config first
    await window.configLoader.loadAll();

    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            const user = await login(username, password);

            if (user) {
                document.getElementById('loginScreen').style.display = 'none';
                document.getElementById('mainApp').style.display = 'flex';

                updateUserInfo();
                updatePermissions();
                await updateStats();

                await initializeApp();
                showMessage('✅ Đăng nhập thành công', 'success');
            } else {
                showMessage('❌ Sai tên đăng nhập hoặc mật khẩu', 'error');
            }
        });
    }

    // Forgot Password Form
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('resetEmail').value.trim();
            const user = APP_STATE.users.find(u => u.email === email);

            if (user) {
                APP_STATE.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
                APP_STATE.resetEmail = email;

                console.log(`📧 Mã xác thực: ${APP_STATE.verificationCode}`);
                showMessage(`Mã xác thực: ${APP_STATE.verificationCode} (Demo)`, 'success', 10000);

                setTimeout(() => {
                    document.getElementById('forgotPasswordContainer').style.display = 'none';
                    document.getElementById('verifyCodeContainer').style.display = 'block';
                }, 2000);
            } else {
                showMessage('Email không tồn tại', 'error');
            }
        });
    }

    // Verify Code Form
    const verifyForm = document.getElementById('verifyCodeForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const code = document.getElementById('verifyCode').value.trim();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;

            if (code !== APP_STATE.verificationCode) {
                showMessage('Mã xác thực không đúng', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                showMessage('Mật khẩu xác nhận không khớp', 'error');
                return;
            }

            if (newPassword.length < 6) {
                showMessage('Mật khẩu phải có ít nhất 6 ký tự', 'error');
                return;
            }

            const user = APP_STATE.users.find(u => u.email === APP_STATE.resetEmail);
            if (user) {
                user.password = newPassword;
                dbSet('users', { users: APP_STATE.users });

                showMessage('Đặt lại mật khẩu thành công', 'success');

                setTimeout(() => {
                    showLogin();
                    verifyForm.reset();
                }, 2000);
            }
        });
    }

    // Work Form
    const workForm = document.getElementById('workForm');
    if (workForm) {
        workForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWork();
        });
    }

    // Member Form
    const memberForm = document.getElementById('memberForm');
    if (memberForm) {
        memberForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveMember();
        });
    }

    // Prevent download
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
            (e.ctrlKey && e.key === 'U') ||
            (e.ctrlKey && e.key === 's')) {
            e.preventDefault();
        }
    });

    // Initialize app
    await initializeApp();
});

// Export functions to global scope
window.login = login;
window.logout = logout;
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.toggleTheme = toggleTheme;
window.closeModal = closeModal;
window.openNotifications = openNotifications;
window.openAddWorkModal = openAddWorkModal;
window.saveWork = saveWork;
window.editWork = editWork;
window.deleteWork = deleteWork;
window.filterWorks = filterWorks;
window.openAddMemberModal = openAddMemberModal;
window.saveMember = saveMember;
window.editMember = editMember;
window.deleteMember = deleteMember;
window.filterMembers = filterMembers;
window.showForgotPassword = showForgotPassword;
window.showLogin = showLogin;
window.openUploadMediaModal = openUploadMediaModal;
window.openAddContentModal = openAddContentModal;
window.openAddUserModal = openAddUserModal;
window.openProfileModal = openProfileModal;
window.filterMedia = filterMedia;
window.filterContent = filterContent;
window.handleGlobalSearch = handleGlobalSearch;
window.backupData = backupData;
window.restoreData = restoreData;

console.log('✅ App script loaded');
