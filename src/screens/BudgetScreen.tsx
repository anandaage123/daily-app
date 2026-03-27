import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Dimensions, StatusBar, ScrollView, Animated, Platform, Modal, SectionList } from 'react-native';
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

interface GroupedExpenses {
  title: string;
  data: Expense[];
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
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // Filter State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // New Expense State
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Lifestyle');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    loadData();
    loadCurrency();
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
        const currencyMap: { [key: string]: string } = {
          'US': '$', 'IN': '₹', 'GB': '£', 'EU': '€', 'JP': '¥', 'CN': '¥', 'RU': '₽', 'BR': 'R$', 'CA': '$', 'AU': '$', 'DE': '€', 'FR': '€'
        };
        setCurrencySymbol(currencyMap[countryCode] || '$');
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

  const deleteTransaction = (id: string) => {
    Alert.alert("Delete", "Delete this transaction?", [
      { text: "Cancel" },
      { text: "Delete", style: 'destructive', onPress: () => saveData(expenses.filter(e => e.id !== id)) }
    ]);
  };

  // Calculations for Filtered View
  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.timestamp);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const totalSpent = filteredExpenses.reduce((sum, item) => item.type === 'expense' ? sum + item.amount : sum, 0);
  const totalIncome = filteredExpenses.reduce((sum, item) => item.type === 'income' ? sum + item.amount : sum, 0);
  const limit = parseFloat(budgetLimit);

  // FIXED: Balance should be limit - total spent + total income
  const balance = limit - totalSpent + totalIncome;

  const progress = Math.min(totalSpent / limit, 1);
  const remaining = limit - totalSpent;

  // Group by Date for SectionList
  const groupExpensesByDate = (items: Expense[]): GroupedExpenses[] => {
    const groups: { [key: string]: Expense[] } = {};
    items.forEach(item => {
      const dateStr = item.date;
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return Object.keys(groups).map(date => ({
      title: date,
      data: groups[date]
    })).sort((a, b) => new Date(b.title).getTime() - new Date(a.title).getTime());
  };

  const groupedData = groupExpensesByDate(filteredExpenses);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const renderItem = ({ item }: { item: Expense }) => {
    const category = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[4];
    const isExpense = item.type === 'expense';

    return (
      <TouchableOpacity
        style={styles.historyItem}
        onLongPress={() => deleteTransaction(item.id)}
      >
        <View style={styles.historyLeft}>
          <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
            <MaterialIcons name={category.icon as any} size={22} color={category.color} />
          </View>
          <View>
            <Text style={styles.historyTitle}>{item.title}</Text>
            <Text style={styles.historySubtitle}>{item.category}</Text>
          </View>
        </View>
        <Text style={[styles.historyAmount, { color: isExpense ? MM_Colors.error : MM_Colors.tertiary }]}>
          {isExpense ? '-' : '+'}{currencySymbol}{item.amount.toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Modern Header */}
      <View style={styles.header}>
        <View>
           <Text style={styles.logoText}>Daily Wallet</Text>
           <TouchableOpacity style={styles.filterTrigger} onPress={() => setIsFilterModalVisible(true)}>
              <Text style={styles.filterText}>{months[selectedMonth]} {selectedYear}</Text>
              <Ionicons name="chevron-down" size={14} color={MM_Colors.primary} />
           </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.limitBtn} onPress={() => setIsLimitModalVisible(true)}>
          <Ionicons name="settings-outline" size={24} color={MM_Colors.primary} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={groupedData}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{title}</Text>
          </View>
        )}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <LinearGradient colors={['#4052B6', '#8899FF']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.balanceCard}>
               <View style={styles.balanceDecoration} />
               <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
               <Text style={styles.balanceValue}>{currencySymbol}{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
               <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                     <Ionicons name="arrow-down-circle" size={16} color={MM_Colors.tertiaryContainer} />
                     <Text style={styles.statValue}>{currencySymbol}{totalIncome.toFixed(0)}</Text>
                  </View>
                  <View style={styles.statItem}>
                     <Ionicons name="arrow-up-circle" size={16} color="#FFDADA" />
                     <Text style={styles.statValue}>{currencySymbol}{totalSpent.toFixed(0)}</Text>
                  </View>
               </View>
            </LinearGradient>

            {/* Budget Progress Box */}
            <View style={styles.budgetProgressBox}>
               <View style={styles.budgetInfo}>
                  <Text style={styles.budgetTitle}>Monthly Budget</Text>
                  <Text style={styles.budgetValue}>{currencySymbol}{totalSpent.toFixed(0)} / {currencySymbol}{limit.toFixed(0)}</Text>
               </View>
               <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: remaining < 0 ? MM_Colors.error : MM_Colors.primary }]} />
               </View>
               <Text style={[styles.remainingText, { color: remaining < 0 ? MM_Colors.error : MM_Colors.textVariant }]}>
                  {remaining < 0 ? `Over by ${currencySymbol}${Math.abs(remaining).toFixed(0)}` : `${currencySymbol}${remaining.toFixed(0)} remaining`}
               </Text>
            </View>

            <Text style={styles.sectionTitle}>Activity History</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="wallet-outline" size={64} color={MM_Colors.surfaceContainer} />
            <Text style={styles.emptyText}>No activity recorded for this period.</Text>
          </View>
        }
      />

      {/* Filter Modal */}
      <Modal visible={isFilterModalVisible} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.filterModalContent}>
               <Text style={styles.modalTitle}>Select Period</Text>

               <Text style={styles.labelSmall}>Year</Text>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[styles.filterChip, selectedYear === y && styles.activeFilterChip]} onPress={() => setSelectedYear(y)}>
                       <Text style={[styles.filterChipText, selectedYear === y && styles.activeFilterChipText]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
               </ScrollView>

               <Text style={styles.labelSmall}>Month</Text>
               <View style={styles.monthGrid}>
                  {months.map((m, idx) => (
                    <TouchableOpacity key={m} style={[styles.monthBox, selectedMonth === idx && styles.activeMonthBox]} onPress={() => setSelectedMonth(idx)}>
                       <Text style={[styles.monthBoxText, selectedMonth === idx && styles.activeMonthBoxText]}>{m.substring(0, 3)}</Text>
                    </TouchableOpacity>
                  ))}
               </View>

               <TouchableOpacity style={styles.saveBtnFull} onPress={() => setIsFilterModalVisible(false)}>
                  <Text style={styles.saveBtnText}>Apply Filter</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsAddModalVisible(true)}>
        <LinearGradient colors={[MM_Colors.primary, MM_Colors.primaryLight]} style={styles.fabGradient}>
           <Ionicons name="add" size={32} color={MM_Colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Add Transaction</Text>
                  <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                     <Ionicons name="close-circle" size={28} color={MM_Colors.textVariant} />
                  </TouchableOpacity>
               </View>

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
                 placeholder="Description"
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

               <TouchableOpacity style={styles.saveBtnFull} onPress={handleAddTransaction}>
                  <Text style={styles.saveBtnText}>Record Transaction</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal visible={isLimitModalVisible} animationType="fade" transparent>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContentSmall}>
               <Text style={styles.modalTitle}>Monthly Budget Limit</Text>
               <View style={styles.amountInputContainer}>
                  <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.modalInput, { flex: 1, paddingLeft: 10 }]}
                    value={budgetLimit}
                    onChangeText={setBudgetLimit}
                    keyboardType="numeric"
                    autoFocus
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
               <TouchableOpacity onPress={() => setIsLimitModalVisible(false)} style={{ marginTop: 15 }}>
                  <Text style={{ color: MM_Colors.textVariant, fontWeight: '700' }}>CANCEL</Text>
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
  logoText: { fontSize: 24, fontWeight: '900', color: MM_Colors.primary, letterSpacing: -1 },
  filterTrigger: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  filterText: { fontSize: 14, fontWeight: '700', color: MM_Colors.textVariant },
  limitBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 2 },

  balanceCard: { marginHorizontal: 24, borderRadius: 32, padding: 28, marginTop: 12, overflow: 'hidden', elevation: 8, shadowColor: MM_Colors.primary, shadowOpacity: 0.2, shadowRadius: 15 },
  balanceDecoration: { position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.1)' },
  balanceLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 8 },
  balanceValue: { fontSize: 36, fontWeight: '900', color: MM_Colors.white, letterSpacing: -1 },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 24 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontSize: 14, fontWeight: '700', color: MM_Colors.white },

  budgetProgressBox: { marginHorizontal: 24, backgroundColor: MM_Colors.white, borderRadius: 24, padding: 20, marginTop: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  budgetInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  budgetTitle: { fontSize: 14, fontWeight: '700', color: MM_Colors.text },
  budgetValue: { fontSize: 12, fontWeight: '600', color: MM_Colors.textVariant },
  progressBar: { height: 8, backgroundColor: MM_Colors.surfaceContainer, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  remainingText: { fontSize: 11, fontWeight: '800', marginTop: 8, textAlign: 'right', textTransform: 'uppercase' },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: MM_Colors.text, marginHorizontal: 24, marginTop: 32, marginBottom: 16 },
  dateHeader: { backgroundColor: MM_Colors.background, paddingHorizontal: 24, paddingVertical: 12 },
  dateHeaderText: { fontSize: 12, fontWeight: '800', color: MM_Colors.outlineVariant, letterSpacing: 1 },

  historyItem: { backgroundColor: MM_Colors.white, marginHorizontal: 24, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, elevation: 1 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 16, fontWeight: '700', color: MM_Colors.text },
  historySubtitle: { fontSize: 12, color: MM_Colors.textVariant, fontWeight: '500', marginTop: 2 },
  historyAmount: { fontSize: 16, fontWeight: '800' },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
  emptyText: { marginTop: 16, color: MM_Colors.textVariant, fontWeight: '600', textAlign: 'center' },

  fab: { position: 'absolute', right: 24, bottom: 24, elevation: 8, shadowColor: MM_Colors.primary, shadowOpacity: 0.3, shadowRadius: 15 },
  fabGradient: { width: 64, height: 64, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(44, 42, 81, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: MM_Colors.surface, borderRadius: 32, padding: 28, width: '100%', gap: 20 },
  modalContentSmall: { backgroundColor: MM_Colors.surface, borderRadius: 32, padding: 28, width: '100%', gap: 20, alignItems: 'center' },
  filterModalContent: { backgroundColor: MM_Colors.surface, borderRadius: 32, padding: 28, width: '100%', gap: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: MM_Colors.text },
  modalInput: { backgroundColor: MM_Colors.background, borderRadius: 16, padding: 16, fontSize: 16, fontWeight: '600', color: MM_Colors.text },
  amountInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: MM_Colors.background, borderRadius: 16, paddingHorizontal: 16 },
  currencyPrefix: { fontSize: 18, fontWeight: '800', color: MM_Colors.primary },
  typeSwitcher: { flexDirection: 'row', backgroundColor: MM_Colors.background, borderRadius: 16, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  typeBtnActive: { backgroundColor: MM_Colors.white, elevation: 2 },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: MM_Colors.textVariant },
  typeBtnTextActive: { color: MM_Colors.primary },
  labelSmall: { fontSize: 11, fontWeight: '800', color: MM_Colors.textVariant, textTransform: 'uppercase', letterSpacing: 1 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: MM_Colors.background },
  catChipText: { fontSize: 12, fontWeight: '700', color: MM_Colors.text },
  saveBtnFull: { width: '100%', padding: 18, borderRadius: 16, alignItems: 'center', backgroundColor: MM_Colors.primary, marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: MM_Colors.white },

  filterScroll: { marginVertical: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: MM_Colors.background, marginRight: 8 },
  activeFilterChip: { backgroundColor: MM_Colors.primary },
  filterChipText: { fontWeight: '700', color: MM_Colors.textVariant },
  activeFilterChipText: { color: MM_Colors.white },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8, justifyContent: 'center' },
  monthBox: { width: '22%', aspectRatio: 1.2, borderRadius: 10, backgroundColor: MM_Colors.background, alignItems: 'center', justifyContent: 'center' },
  activeMonthBox: { backgroundColor: MM_Colors.primary },
  monthBoxText: { fontSize: 12, fontWeight: '700', color: MM_Colors.textVariant, textAlign: 'center', width: '100%' },
  activeMonthBoxText: { color: MM_Colors.white },
});
