    function fetchUsers() {
        const token = sessionStorage.getItem('cdf_auth_token');
        if (!token) return;
        
        document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 32px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading users...</td></tr>';
        
        google.script.run
            .withSuccessHandler(function(users) {
                usersListCache = users;
                renderUsersTable();
            })
            .withFailureHandler(function(err) {
                showCustomAlert('Error', 'Failed to load users: ' + err.message, false, null, 'error');
            })
            .adminGetUsers(token);
    }
    function renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        if (usersListCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 32px;">No users found.</td></tr>';
            return;
        }
        
        usersListCache.forEach(u => {
            const roleClass = u.role.replace(/\s+/g, ''); // "Data Entry" -> "DataEntry"
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${u.id}</td>
                <td>${u.name}</td>
                <td><span class="um-role-badge um-role-${roleClass}">${u.role}</span></td>
                <td><span class="um-status-${u.status}">${u.status}</span></td>
                <td>
                    <div class="um-actions">
                        <button class="um-btn-icon" title="Edit User" onclick="editUser('${u.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="um-btn-icon danger" title="Delete User" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    function openUserModal() {
        document.getElementById('umForm').reset();
        document.getElementById('umMode').value = 'add';
        document.getElementById('umUserId').disabled = false;
        document.getElementById('umModalTitle').innerText = 'Add New User';
        document.getElementById('umSubmitBtn').innerHTML = '<i class="fa-solid fa-user-plus"></i> Create User';
        
        document.getElementById('umModalOverlay').classList.add('open');
        document.getElementById('umModal').classList.add('open');
    }
    function closeUserModal() {
        document.getElementById('umModalOverlay').classList.remove('open');
        document.getElementById('umModal').classList.remove('open');
    }
    function editUser(id) {
        const user = usersListCache.find(u => u.id === id);
        if (!user) return;
        
        document.getElementById('umMode').value = 'edit';
        document.getElementById('umUserId').value = user.id;
        document.getElementById('umUserId').disabled = true; // Cannot change ID
        document.getElementById('umPassword').value = user.password;
        document.getElementById('umName').value = user.name;
        document.getElementById('umRole').value = user.role;
        document.getElementById('umStatus').value = user.status;
        
        document.getElementById('umModalTitle').innerText = 'Edit User';
        document.getElementById('umSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update User';
        
        document.getElementById('umModalOverlay').classList.add('open');
        document.getElementById('umModal').classList.add('open');
    }
    function saveUser() {
        const mode = document.getElementById('umMode').value;
        const userData = {
            id: document.getElementById('umUserId').value.trim(),
            password: document.getElementById('umPassword').value.trim(),
            name: document.getElementById('umName').value.trim(),
            role: document.getElementById('umRole').value,
            status: document.getElementById('umStatus').value
        };
        
        const token = sessionStorage.getItem('cdf_auth_token');
        const btn = document.getElementById('umSubmitBtn');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        
        if (mode === 'add') {
            google.script.run
                .withSuccessHandler(function() {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    closeUserModal();
                    showCustomAlert('Success', 'User created successfully.', false, null, 'success');
                    fetchUsers();
                })
                .withFailureHandler(function(err) {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    showCustomAlert('Error', err.message, false, null, 'error');
                })
                .adminCreateUser(token, userData);
        } else {
            google.script.run
                .withSuccessHandler(function() {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    closeUserModal();
                    showCustomAlert('Success', 'User updated successfully.', false, null, 'success');
                    fetchUsers();
                })
                .withFailureHandler(function(err) {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    showCustomAlert('Error', err.message, false, null, 'error');
                })
                .adminUpdateUser(token, userData);
        }
    }
    function deleteUser(id) {
        if (id === 'admin' || id === sessionStorage.getItem('cdf_user_name')) {
            showCustomAlert('Warning', 'You cannot delete the primary admin or your own account.', false, null, 'warning');
            return;
        }
        
        showCustomAlert('Confirm Deletion', 'Are you sure you want to permanently delete user "' + id + '"?', true, function() {
            const token = sessionStorage.getItem('cdf_auth_token');
            google.script.run
                .withSuccessHandler(function() {
                    showCustomAlert('Success', 'User deleted.', false, null, 'success');
                    fetchUsers();
                })
                .withFailureHandler(function(err) {
                    showCustomAlert('Error', err.message, false, null, 'error');
                })
                .adminDeleteUser(token, id);
        }, 'danger');
    }
function loadUserProfile() {
    const name = sessionStorage.getItem('cdf_user_name') || 'User';
    const role = sessionStorage.getItem('cdf_user_role') || 'Role';
    
    document.getElementById('profileAvatar').innerText = name.charAt(0).toUpperCase();
    document.getElementById('profileDisplayName').innerText = name;
    document.getElementById('profileDisplayRole').innerText = role;
    document.getElementById('profileNameInput').value = name;
    document.getElementById('profilePasswordInput').value = '';
    
    const token = sessionStorage.getItem('cdf_auth_token');
    google.script.run
        .withSuccessHandler(user => {
            if (user && user.id) {
                document.getElementById('profileUserId').innerText = user.id;
            }
        })
        .verifyToken(token);
}
function submitProfileUpdate() {
    const name = document.getElementById('profileNameInput').value.trim();
    const password = document.getElementById('profilePasswordInput').value.trim();
    
    if (!name || !password) {
        showCustomAlert('Error', 'Name and Password are required.', false, null, 'danger');
        return;
    }
    
    const token = sessionStorage.getItem('cdf_auth_token');
    const btn = document.getElementById('profileSubmitBtn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class=\"fa-solid fa-spinner fa-spin\"></i> Updating...';
    
    google.script.run
        .withSuccessHandler(response => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            if (response.success) {
                sessionStorage.setItem('cdf_user_name', response.user.name);
                showCustomAlert('Success', 'Profile updated successfully!', false, null, 'success');
                loadUserProfile();
                
                document.getElementById('globalUserAvatar').innerText = response.user.name.charAt(0).toUpperCase();
                document.querySelector('.user-name').innerText = response.user.name;
            } else {
                showCustomAlert('Error', response.message || 'Failed to update profile.', false, null, 'danger');
            }
        })
        .withFailureHandler(error => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            showCustomAlert('Error', 'Server error. Please try again.', false, null, 'danger');
        })
        .updateMyProfile(token, { name: name, password: password });
}
