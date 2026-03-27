import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Dimensions, StatusBar, ScrollView, Animated, Platform, Modal, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  type: 'expense' | 'income';
  timestamp: number;
}

const MM_Colors = {
  primary: '#4052B6',
  primaryLight: '#8899FF',
  background: '#F9F5FF',
  surface: '#FFFFFF',
  surfaceContainer: '#E9E5FF',
  surfaceContainerHigh: '#E3DFFF',
  surfaceContainerLow: '#F3EEFF',
  surfaceContainerLowest: '#FFFFFF',
  text: '#2C2A51',
  textVariant: '#5A5781',
  outlineVariant: '#ACA8D7',
  onBackground: '#2C2A51',
  onSurfaceVariant: '#5A5781',
  primaryDim: '#3346A9',
  secondary: '#765600',
  secondaryContainer: '#FFCA53',
  onSecondaryContainer: '#5C4300',
  tertiary: '#006947',
  tertiaryContainer: '#69F6B8',
  onTertiaryContainer: '#005A3C',
  error: '#B41340',
  white: '#FFFFFF',
  primaryContainer: '#8899FF',
};

const CATEGORIES = [
  { name: 'Lifestyle', icon: 'local-mall', family: 'MaterialIcons', color: '#FFCA53' },
  { name: 'Dining', icon: 'restaurant', family: 'MaterialIcons', color: '#8899FF' },
  { name: 'Income', icon: 'work', family: 'MaterialIcons', color: '#69F6B8' },
  { name: 'Transport', icon: 'directions-car', family: 'MaterialIcons', color: '#FFCA53' },
  { name: 'Other', icon: 'payments', family: 'MaterialIcons', color: '#ACA8D7' },
];

export default function BudgetScreen() {
  const navigation = useNavigation<NavigationProp<any>>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgetLimit, setBudgetLimit] = useState('4500');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isLimitModalVisible, setIsLimitModalVisible] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // Filter State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedMonthYear] = useState(new Date().getFullYear());

  // New Expense State
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Lifestyle');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    loadData();
    loadCurrency();
    checkMonthlyReset();
  }, []);

  const loadData = async () => {
    try {
      const storedExpenses = await AsyncStorage.getItem('@daily_expenses_v2');
      if (storedExpenses) setExpenses(JSON.parse(storedExpenses));
      
      const storedLimit = await AsyncStorage.getItem('@budget_limit_v2');
      if (storedLimit) setBudgetLimit(storedLimit);
    } catch(e) {}
  };

  const loadCurrency = async () => {
    try {
      const countryCode = await AsyncStorage.getItem('@user_country_code');
      if (countryCode) {
        // Map common country codes to currency symbols
        const currencyMap: { [key: string]: string } = {
          'US': '$', 'IN': '₹', 'GB': '£', 'EU': '€', 'JP': '¥', 'CN': '¥', 'RU': '₽', 'BR': 'R$', 'CA': '$', 'AU': '$', 'DE': '€', 'FR': '€'
        };
        setCurrencySymbol(currencyMap[countryCode] || '$');
      }
    } catch (e) {}
  };

  const checkMonthlyReset = async () => {
    try {
      const lastReset = await AsyncStorage.getItem('@budget_last_reset_month');
      const currentMonth = new Date().getMonth().toString();
      if (lastReset !== currentMonth) {
        await AsyncStorage.setItem('@budget_last_reset_month', currentMonth);
      }
    } catch (e) {}
  };

  const saveData = async (newExpenses: Expense[], newLimit?: string) => {
    setExpenses(newExpenses);
    if (newLimit) setBudgetLimit(newLimit);
    try {
      await AsyncStorage.setItem('@daily_expenses_v2', JSON.stringify(newExpenses));
      if (newLimit) await AsyncStorage.setItem('@budget_limit_v2', newLimit);
    } catch(e) {}
  };

  const handleAddTransaction = () => {
    const amt = parseFloat(newAmount);
    if (newTitle.trim() && !isNaN(amt) && amt > 0) {
      const now = new Date();
      const transaction: Expense = {
        id: Date.now().toString(),
        title: newTitle.trim(),
        amount: amt,
        date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        category: newCategory,
        type: newType,
        timestamp: now.getTime(),
      };
      saveData([transaction, ...expenses]);
      setIsAddModalVisible(false);
      setNewTitle('');
      setNewAmount('');
    } else {
      Alert.alert("Invalid Input", "Please enter valid details.");
    }
  };

  // Calculations
  const now = new Date();
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const lastMonthExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp);
    let targetMonth = now.getMonth() - 1;
    let targetYear = now.getFullYear();
    if (targetMonth < 0) { targetMonth = 11; targetYear -= 1; }
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  });

  const totalSpentThisMonth = currentMonthExpenses.reduce((sum, item) => item.type === 'expense' ? sum + item.amount : sum, 0);
  const totalSpentLastMonth = lastMonthExpenses.reduce((sum, item) => item.type === 'expense' ? sum + item.amount : sum, 0);

  const diffPercent = totalSpentLastMonth === 0
    ? (totalSpentThisMonth > 0 ? 100 : 0)
    : ((totalSpentThisMonth - totalSpentLastMonth) / totalSpentLastMonth) * 100;

  const totalIncome = currentMonthExpenses.reduce((sum, item) => item.type === 'income' ? sum + item.amount : sum, 0);
  const balance = totalIncome - totalSpentThisMonth;
  const limit = parseFloat(budgetLimit);
  const progress = Math.min(totalSpentThisMonth / limit, 1);
  const remaining = limit - totalSpentThisMonth;

  // Filtered Display List
  const displayExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const renderTransaction = ({ item }: { item: Expense }) => {
    const category = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[4];
    const isExpense = item.type === 'expense';

    return (
      <TouchableOpacity
        style={styles.historyItem}
        onLongPress={() => {
          Alert.alert("Delete", "Delete this transaction?", [
            { text: "Cancel" },
            { text: "Delete", style: 'destructive', onPress: () => saveData(expenses.filter(e => e.id !== item.id)) }
          ]);
        }}
      >
        <View style={styles.historyLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: category.family === 'MaterialIcons' ? category.color + '30' : MM_Colors.primary + '30' }]}>
            {category.family === 'MaterialIcons' ? (
              <MaterialIcons name={category.icon as any} size={24} color={category.color} />
            ) : (
              <MaterialCommunityIcons name={category.icon as any} size={24} color={MM_Colors.primary} />
            )}
          </View>
          <View>
            <Text style={styles.historyTitle}>{item.title}</Text>
            <Text style={styles.historySubtitle}>{item.date} • {item.category}</Text>
          </View>
        </View>
        <Text style={[styles.historyAmount, { color: isExpense ? MM_Colors.error : MM_Colors.tertiary }]}>
          {isExpense ? '-' : '+'}{currencySymbol}{item.amount.toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Top App Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
           <Text style={styles.logoText}>Daily Wallet</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="notifications-outline" size={24} color={MM_Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Total Balance Card */}
        <LinearGradient colors={['#4052B6', '#8899FF']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.balanceCard}>
           <View style={styles.balanceDecoration} />
           <Text style={styles.balanceLabel}>MONTHLY BALANCE</Text>
           <Text style={styles.balanceValue}>{currencySymbol}{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
           <View style={styles.balanceTrend}>
              <View style={[styles.trendBadge, { backgroundColor: diffPercent <= 0 ? MM_Colors.tertiaryContainer : '#FFDADA' }]}>
                 <Ionicons name={diffPercent <= 0 ? "trending-down" : "trending-up"} size={14} color={diffPercent <= 0 ? MM_Colors.onTertiaryContainer : MM_Colors.error} />
                 <Text style={[styles.trendText, { color: diffPercent <= 0 ? MM_Colors.onTertiaryContainer : MM_Colors.error }]}>
                   {Math.abs(diffPercent).toFixed(1)}%
                 </Text>
              </View>
              <Text style={styles.trendSub}>vs last month</Text>
           </View>
        </LinearGradient>

        {/* Budget Bento Grid */}
        <View style={styles.bentoGrid}>
           <TouchableOpacity style={styles.budgetBox} onPress={() => setIsLimitModalVisible(true)}>
              <View style={styles.budgetHeader}>
                 <View>
                    <Text style={styles.bentoTitle}>Monthly Budget</Text>
                    <Text style={styles.bentoSubtitle}>Target: {currencySymbol}{limit.toFixed(2)}</Text>
                 </View>
                 <View style={[styles.statusBadge, { backgroundColor: remaining < 0 ? '#FFDADA' : MM_Colors.secondaryContainer }]}>
                    <Text style={[styles.statusText, { color: remaining < 0 ? MM_Colors.error : MM_Colors.onSecondaryContainer }]}>
                      {remaining < 0 ? 'OVER BUDGET' : 'ON TRACK'}
                    </Text>
                 </View>
              </View>
              <View style={styles.progressContainer}>
                 <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: remaining < 0 ? MM_Colors.error : MM_Colors.primary }]} />
                 </View>
                 <View style={styles.progressLabels}>
                    <Text style={styles.progressSubText}>{currencySymbol}{totalSpentThisMonth.toFixed(2)} spent</Text>
                    <Text style={styles.progressSubText}>{remaining < 0 ? 'Over' : ''} {currencySymbol}{Math.abs(remaining).toFixed(2)} {remaining < 0 ? '!' : 'left'}</Text>
                 </View>
              </View>
           </TouchableOpacity>

           <TouchableOpacity style={styles.addQuickBox} onPress={() => setIsAddModalVisible(true)}>
              <View style={styles.addIconCircle}>
                 <Ionicons name="add-circle" size={32} color={MM_Colors.onTertiaryContainer} />
              </View>
              <View>
                 <Text style={styles.addTitle}>Add Transaction</Text>
                 <Text style={styles.addSubtitle}>Log recent activity.</Text>
              </View>
           </TouchableOpacity>
        </View>

        {/* History Section */}
        <View style={styles.historySection}>
           <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Activity</Text>
              <View style={styles.monthSelector}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {months.map((m, idx) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSelectedMonth(idx)}
                      style={[styles.monthChip, selectedMonth === idx && styles.activeMonthChip]}
                    >
                      <Text style={[styles.monthText, selectedMonth === idx && styles.activeMonthText]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
           </View>

           <FlatList
             data={displayExpenses}
             renderItem={renderTransaction}
             keyExtractor={item => item.id}
             scrollEnabled={false}
             ListEmptyComponent={<Text style={styles.emptyText}>No transactions for this month.</Text>}
           />
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsAddModalVisible(true)}>
        <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.fabGradient}>
           <Ionicons name="add" size={32} color={MM_Colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <Text style={styles.modalTitle}>New Transaction</Text>

               <View style={styles.typeSwitcher}>
                  <TouchableOpacity
                    style={[styles.typeBtn, newType === 'expense' && styles.typeBtnActive]}
                    onPress={() => setNewType('expense')}
                  >
                     <Text style={[styles.typeBtnText, newType === 'expense' && styles.typeBtnTextActive]}>Expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, newType === 'income' && styles.typeBtnActive]}
                    onPress={() => setNewType('income')}
                  >
                     <Text style={[styles.typeBtnText, newType === 'income' && styles.typeBtnTextActive]}>Income</Text>
                  </TouchableOpacity>
               </View>

               <TextInput
                 style={styles.modalInput}
                 placeholder={newType === 'expense' ? "e.g. Groceries" : "e.g. Salary"}
                 placeholderTextColor={MM_Colors.textVariant}
                 value={newTitle}
                 onChangeText={setNewTitle}
               />
               <View style={styles.amountInputContainer}>
                  <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, paddingLeft: 10 }]}
                    placeholder="0.00"
                    placeholderTextColor={MM_Colors.textVariant}
                    keyboardType="decimal-pad"
                    value={newAmount}
                    onChangeText={setNewAmount}
                  />
               </View>

               <Text style={styles.labelSmall}>Category</Text>
               <View style={styles.categoryGrid}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.name}
                      style={[styles.catChip, newCategory === cat.name && { backgroundColor: MM_Colors.primary }]}
                      onPress={() => setNewCategory(cat.name)}
                    >
                       <Text style={[styles.catChipText, newCategory === cat.name && { color: MM_Colors.white }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
               </View>

               <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddModalVisible(false)}>
                     <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleAddTransaction}>
                     <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal visible={isLimitModalVisible} animationType="fade" transparent>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContentSmall}>
               <Text style={styles.modalTitle}>Set Monthly Budget</Text>
               <View style={styles.amountInputContainer}>
                  <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, paddingLeft: 10 }]}
                    value={budgetLimit}
                    onChangeText={setBudgetLimit}
                    keyboardType="numeric"
                    autoFocus
                    placeholderTextColor={MM_Colors.textVariant}
                  />
               </View>
               <TouchableOpacity
                 style={styles.saveBtnFull}
                 onPress={() => {
                   saveData(expenses, budgetLimit);
                   setIsLimitModalVisible(false);
                 }}
               >
                  <Text style={styles.saveBtnText}>Update Limit</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MM_Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, marginTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: { fontSize: 24, fontWeight: '900', color: MM_Colors.primary, letterSpacing: -1 },
  searchBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  balanceCard: { marginHorizontal: 24, borderRadius: 32, padding: 32, marginTop: 12, overflow: 'hidden', elevation: 10, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
  balanceDecoration: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
  balanceLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 2, marginBottom: 8 },
  balanceValue: { fontSize: 42, fontWeight: '800', color: MM_Colors.white, letterSpacing: -1 },
  balanceTrend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: MM_Colors.tertiaryContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  trendText: { fontSize: 12, fontWeight: '800', color: MM_Colors.onTertiaryContainer },
  trendSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },

  bentoGrid: { paddingHorizontal: 24, marginTop: 32, gap: 16 },
  budgetBox: { backgroundColor: MM_Colors.surfaceContainerLow, borderRadius: 24, padding: 24, gap: 24 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bentoTitle: { fontSize: 18, fontWeight: '800', color: MM_Colors.text },
  bentoSubtitle: { fontSize: 14, color: MM_Colors.textVariant, fontWeight: '600' },
  statusBadge: { backgroundColor: MM_Colors.secondaryContainer, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '800', color: MM_Colors.onSecondaryContainer },
  progressContainer: { gap: 12 },
  progressBar: { height: 12, backgroundColor: MM_Colors.outlineVariant, borderRadius: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 10 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressSubText: { fontSize: 12, fontWeight: '700', color: MM_Colors.textVariant },

  addQuickBox: { backgroundColor: MM_Colors.tertiary, borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  addIconCircle: { width: 56, height: 56, borderRadius: 18, backgroundColor: MM_Colors.tertiaryContainer, alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontSize: 18, fontWeight: '800', color: MM_Colors.white },
  addSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  historySection: { paddingHorizontal: 24, marginTop: 40 },
  sectionHeader: { marginBottom: 24 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: MM_Colors.text, marginBottom: 12 },
  monthSelector: { flexDirection: 'row' },
  monthChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: MM_Colors.surfaceContainer, marginRight: 8 },
  activeMonthChip: { backgroundColor: MM_Colors.primary },
  monthText: { fontWeight: '700', color: MM_Colors.textVariant },
  activeMonthText: { color: MM_Colors.white },

  historyItem: { backgroundColor: MM_Colors.surface, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  categoryIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 17, fontWeight: '700', color: MM_Colors.text },
  historySubtitle: { fontSize: 13, color: MM_Colors.textVariant, fontWeight: '500', marginTop: 2 },
  historyAmount: { fontSize: 18, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: MM_Colors.textVariant, marginTop: 40, fontSize: 16, fontWeight: '500' },

  fab: { position: 'absolute', right: 24, bottom: 24, elevation: 8, shadowColor: MM_Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
  fabGradient: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: MM_Colors.surface, borderRadius: 32, padding: 32, width: '100%', gap: 20 },
  modalContentSmall: { backgroundColor: MM_Colors.surface, borderRadius: 32, padding: 32, width: '100%', gap: 20, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: MM_Colors.text, marginBottom: 8 },
  modalInput: { backgroundColor: MM_Colors.background, borderRadius: 16, padding: 18, fontSize: 16, fontWeight: '600', color: MM_Colors.text },
  amountInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: MM_Colors.background, borderRadius: 16, paddingHorizontal: 18 },
  currencyPrefix: { fontSize: 18, fontWeight: '800', color: MM_Colors.primary },
  typeSwitcher: { flexDirection: 'row', backgroundColor: MM_Colors.background, borderRadius: 16, padding: 6 },
  typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  typeBtnActive: { backgroundColor: MM_Colors.surface, elevation: 2 },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: MM_Colors.textVariant },
  typeBtnTextActive: { color: MM_Colors.primary },
  labelSmall: { fontSize: 12, fontWeight: '800', color: MM_Colors.textVariant, textTransform: 'uppercase', letterSpacing: 1 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: MM_Colors.background },
  catChipText: { fontSize: 13, fontWeight: '700', color: MM_Colors.text },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 18, borderRadius: 16, alignItems: 'center', backgroundColor: MM_Colors.background },
  cancelBtnText: { fontSize: 16, fontWeight: '700', color: MM_Colors.textVariant },
  saveBtn: { flex: 2, padding: 18, borderRadius: 16, alignItems: 'center', backgroundColor: MM_Colors.primary },
  saveBtnFull: { width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', backgroundColor: MM_Colors.primary },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: MM_Colors.white },
});
