# GhostPass Admin Command Center

The **Command Center** is a powerful administrative interface for GhostPass Wallet that provides comprehensive system management, audit logging, and financial controls.

## 🚀 Features

### 1. **Admin Mode Toggle**
- **Location**: Bottom of left sidebar (desktop) or main wallet screen
- **Visual**: Subtle "⚙ ADMIN MODE" button
- **States**: 
  - OFF: Gray text, subtle appearance
  - ON: Red glow, pulsing animation, danger styling
- **Access**: Only visible to users with `ADMIN` role

### 2. **Command Center Dashboard**
- **System Overview**: Real-time statistics
  - Total users, wallets, balance
  - Active/expired passes
  - Pending payouts
  - Revenue metrics (daily, weekly, monthly)
- **Recent Activity**: Latest transactions, payouts, audit logs

### 3. **Revenue Split Configuration**
- **Interactive Sliders**: Adjust fee percentages in real-time
  - Valid % (default: 30%)
  - Vendor % (default: 30%) 
  - Pool % (default: 30%)
  - Promoter % (default: 10%)
- **Live Preview**: Shows dollar amounts on $100 scan
- **Validation**: Ensures percentages sum to exactly 100%
- **Audit Logging**: All changes tracked with old/new values

### 4. **Gateway Scan Fees**
- **Venue-Specific Pricing**: Set different fees per venue
- **Global Default**: Fallback fee for unspecified venues
- **Range**: $0.01 to $0.50 per scan
- **Real-time Updates**: Changes apply immediately

### 5. **GhostPass Pricing Control**
- **Three Tiers**: 1-day, 3-day, 7-day passes
- **Flexible Pricing**: Set any amount from $1.00 to $100.00
- **Forward-Only**: Changes affect new purchases only
- **Warning System**: Clear indication of impact scope

### 6. **Vendor Payout Management**
- **Payout Queue**: View all pending payout requests
- **Individual Actions**: Approve, reject, or process each request
- **Batch Processing**: "Process All" for bulk operations
- **Audit Trail**: Complete history of payout decisions
- **Vendor Information**: Email, amount, request date

### 7. **Data Retention Override**
- **Compliance Controls**: Modify transaction retention periods
- **Justification Required**: Mandatory explanation for changes
- **Audit Logging**: All overrides tracked with reasoning
- **Warning System**: Compliance risk notifications

### 8. **Comprehensive Audit System**
- **Action Logging**: Every admin operation recorded
- **Detailed Tracking**: Old values, new values, timestamps
- **Admin Attribution**: Links actions to specific admin users
- **Searchable History**: Filter by action type, date range
- **Export Capability**: Download audit logs as CSV

## 🎨 Visual Design

### **Abyssal Glass Theme with Red Danger Accents**
- **Color Palette**: Deep slate backgrounds with red (#ef4444) highlights
- **Glass Morphism**: Translucent panels with backdrop blur
- **Neon Glows**: Red drop shadows and border effects
- **Typography**: JetBrains Mono for data, Inter for UI text
- **Animations**: Subtle pulsing, smooth transitions

### **Component Styling**
- **Glass Panels**: `glass-panel` with red border variants
- **Danger Buttons**: Red backgrounds with glow effects
- **Sliders**: Custom red-themed range inputs
- **Status Badges**: Color-coded for different states
- **Warning Banners**: Yellow accents for compliance alerts

## 🔐 Security & Access Control

### **Role-Based Access Control (RBAC)**
- **User Roles**: `USER`, `VENDOR`, `ADMIN`
- **Backend Validation**: All admin endpoints check user role
- **Frontend Hiding**: Admin UI hidden for non-admin users
- **Token Validation**: JWT tokens include role information

### **Audit Logging**
- **Comprehensive Tracking**: Every admin action logged
- **Immutable Records**: Audit logs cannot be modified
- **Metadata Storage**: Context and reasoning captured
- **Compliance Ready**: Meets audit trail requirements

### **Double Confirmation**
- **Destructive Actions**: Require explicit confirmation
- **Batch Operations**: Additional warning dialogs
- **Retention Changes**: Compliance risk warnings

## 🛠 Technical Implementation

### **Backend Architecture**
- **FastAPI Routes**: `/admin/*` endpoints with role validation
- **Database Schema**: Extended with admin tables
- **Audit Functions**: Automatic logging middleware
- **Atomic Operations**: Database transactions for consistency

### **Frontend Components**
- **AdminModeToggle**: Sidebar toggle component
- **CommandCenter**: Full-screen admin dashboard
- **CollapsibleSection**: Organized admin controls
- **Real-time Updates**: Live data refresh and validation

### **Database Extensions**
```sql
-- New tables added:
- audit_logs: Admin action tracking
- system_configs: Global configuration storage
- payout_requests: Vendor payout management
- users.role: User role field (USER/VENDOR/ADMIN)
```

## 📋 Setup Instructions

### 1. **Database Setup**
```bash
cd backend
python setup_admin.py
```
This script will:
- Create admin-specific database tables
- Set up default system configurations
- Promote your first admin user

### 2. **Create Admin User**
1. Register a normal user account through the app
2. Run the setup script and enter the user's email
3. The script will promote them to admin role

### 3. **Access Admin Mode**
1. Login with admin credentials
2. Look for "⚙ ADMIN MODE" toggle in sidebar
3. Click to activate and open Command Center

### 4. **Test Admin Functionality**
```bash
cd backend
python test_admin.py
```

## 🔍 API Endpoints

### **Admin Dashboard**
- `GET /admin/dashboard` - System overview and statistics

### **Fee Management**
- `POST /admin/fees/config` - Update revenue split percentages
- `POST /admin/fees/scan` - Update scan fees per venue

### **Pricing Control**
- `POST /admin/pricing/ghostpass` - Update pass pricing

### **Payout Management**
- `GET /admin/payouts` - List payout requests
- `POST /admin/payouts/{id}/action` - Process individual payout
- `POST /admin/payouts/process-all` - Batch process payouts

### **System Configuration**
- `POST /admin/retention/override` - Override data retention

### **Audit & User Management**
- `GET /admin/audit-logs` - Retrieve audit trail
- `GET /admin/users` - List users with pagination
- `POST /admin/users/{id}/role` - Update user role

## 🚨 Important Notes

### **Security Considerations**
- Admin access is logged and audited
- All configuration changes are tracked
- Role validation occurs on both frontend and backend
- Sensitive operations require justification

### **Compliance Features**
- Complete audit trail for all admin actions
- Data retention controls with justification requirements
- Immutable logging system
- Export capabilities for compliance reporting

### **Performance Optimizations**
- Efficient database queries with proper indexing
- Real-time validation without server round-trips
- Optimized dashboard loading with statistics caching
- Pagination for large data sets

## 🎯 Usage Examples

### **Adjusting Revenue Splits**
1. Open Command Center
2. Navigate to "Revenue Split Configuration"
3. Use sliders to adjust percentages
4. Verify total equals 100%
5. Click "APPLY CHANGES"
6. Changes are immediately active and logged

### **Processing Vendor Payouts**
1. Review pending payouts in dashboard
2. Individual actions: Click APPROVE/REJECT per request
3. Batch processing: Click "PROCESS ALL" for bulk approval
4. All actions are logged with timestamps

### **Monitoring System Activity**
1. Check dashboard statistics for system health
2. Review recent transactions and audit logs
3. Monitor payout queue and user activity
4. Export audit logs for compliance reporting

The Command Center provides complete administrative control while maintaining security, auditability, and compliance with financial regulations.