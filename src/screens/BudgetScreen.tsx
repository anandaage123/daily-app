import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  FlatList,
  Pressable
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Transaction {
  id: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  date: string;
  comment?: string;
}

const CATEGORIES = {
  expense: [
    { name: 'Food', icon: 'fast-food-outline' },
    { name: 'Transport', icon: 'car-outline' },
    { name: 'Shopping', icon: 'cart-outline' },
    { name: 'Bills', icon: 'receipt-outline' },
    { name: 'Entertainment', icon: 'game-controller-outline' },
    { name: 'Others', icon: 'ellipsis-horizontal-outline' }
  ],
  income: [
    { name: 'Salary', icon: 'cash-outline' },
    { name: 'Freelance', icon: 'laptop-outline' },
    { name: 'Gift', icon: 'gift-outline' },
    { name: 'Others', icon: 'ellipsis-horizontal-outline' }
  ]
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate years from 2020 to current year + 1
const START_YEAR = 2020;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 2 }, (_, i) => (START_YEAR + i).toString()).reverse();

export default function BudgetScreen() {
  const { colors, isDark } = useTheme();
  const isFocused = useIsFocused();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Others');
  const [comment, setComment] = useState('');

  const currentBudgetLimit = budgets[`${selectedMonth}-${selectedYear}`] || 4500;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 24,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { ...Typography.header, fontSize: 32, color: colors.text },
    filterTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      ...Shadows.soft,
      gap: 8,
    },
    filterText: { ...Typography.body, fontSize: 15, fontWeight: '700', color: colors.text },
    
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 24,
      ...Shadows.soft,
      marginBottom: 24,
      overflow: 'hidden',
    },
    summaryLabel: { ...Typography.caption, color: colors.textVariant, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    balanceText: { ...Typography.header, fontSize: 42, color: colors.text, marginBottom: 20 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.background, paddingTop: 20 },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { ...Typography.caption, color: colors.textVariant, marginBottom: 4 },
    statValue: { ...Typography.title, fontSize: 18, fontWeight: '800' },
    divider: { width: 1, height: '100%', backgroundColor: colors.background, marginHorizontal: 12 },

    sectionHeader: {
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    sectionTitle: { ...Typography.caption, fontWeight: '800', color: colors.textVariant, letterSpacing: 1 },

    transactionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 24,
      marginBottom: 12,
      padding: 16,
      borderRadius: 20,
      ...Shadows.soft,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    txInfo: { flex: 1 },
    txCategory: { ...Typography.title, fontSize: 16, color: colors.text },
    txComment: { ...Typography.caption, color: colors.textVariant, marginTop: 2 },
    txAmount: { ...Typography.title, fontSize: 17, fontWeight: '800' },

    fab: {
      position: 'absolute',
      bottom: 30,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 24,
      ...Shadows.soft,
      overflow: 'hidden',
    },
    fabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,14,23,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      padding: 32,
      paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    sheetTitle: { ...Typography.header, fontSize: 24, color: colors.text },
    
    typeToggle: { flexDirection: 'row', backgroundColor: colors.background, padding: 4, borderRadius: 16, marginBottom: 28 },
    typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    typeBtnActive: { backgroundColor: colors.surface, ...Shadows.soft },
    typeText: { ...Typography.body, fontWeight: '700', color: colors.textVariant },
    typeTextActive: { color: colors.primary },

    inputLabel: { ...Typography.caption, fontWeight: '800', color: colors.textVariant, marginBottom: 12, letterSpacing: 1 },
    amountInput: {
      ...Typography.header,
      fontSize: 48,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 28,
    },
    commentInput: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      ...Typography.body,
      color: colors.text,
      marginBottom: 28,
    },
    categoryList: { marginBottom: 28 },
    catItem: { alignItems: 'center', marginRight: 20, width: 70 },
    catIconBox: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    catIconBoxActive: { backgroundColor: colors.primary },
    catName: { ...Typography.caption, fontSize: 11, fontWeight: '700', textAlign: 'center' },

    submitBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 18,
      alignItems: 'center',
      ...Shadows.soft,
    },
    submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
    inputGroup: { marginBottom: 28 },
    amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
    currency: { ...Typography.header, fontSize: 32, color: colors.textVariant, marginRight: 8 },
    monthCard: {
      width: '30%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginBottom: 12,
      ...Shadows.soft,
    },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
    emptyText: { ...Typography.body, color: colors.textVariant, marginTop: 16 },
  });

  useEffect(() => {
    loadData();
  }, [isFocused]);

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem('@daily_expenses_v2');
      const storedBudgets = await AsyncStorage.getItem('@budget_limits_v3');
      const oldLimit = await AsyncStorage.getItem('@budget_limit_v2');

      if (stored) setTransactions(JSON.parse(stored));

      let budgetsObj: Record<string, number> = {};
      if (storedBudgets) {
        budgetsObj = JSON.parse(storedBudgets);
      } else if (oldLimit) {
        const currentKey = `${MONTHS[new Date().getMonth()]}-${new Date().getFullYear()}`;
        budgetsObj[currentKey] = parseFloat(oldLimit);
      }
      setBudgets(budgetsObj);
    } catch (e) {}
  };

  const saveData = async (txs: Transaction[], bgs?: Record<string, number>) => {
    try {
      setTransactions(txs);
      await AsyncStorage.setItem('@daily_expenses_v2', JSON.stringify(txs));
      if (bgs) {
        await AsyncStorage.setItem('@budget_limits_v3', JSON.stringify(bgs));
      }
    } catch (e) {}
  };

  const addTransaction = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const newTx: Transaction = {
      id: Date.now().toString(),
      amount: val,
      category,
      type,
      date: new Date().toISOString(),
      comment: comment.trim() || undefined
    };

    saveData([newTx, ...transactions]);
    setAmount('');
    setComment('');
    setCategory('Others');
    setIsAdding(false);
  };

  const deleteTransaction = (id: string) => {
    Alert.alert('Delete', 'Delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => saveData(transactions.filter(t => t.id !== id)) }
    ]);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return MONTHS[d.getMonth()] === selectedMonth && d.getFullYear().toString() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = currentBudgetLimit - totalExpenses + totalIncome;
  const progress = Math.min(totalExpenses / currentBudgetLimit, 1);

  const totals = { income: totalIncome, expense: totalExpenses };
  const sections = useMemo(() => {
    const groups = filteredTransactions.reduce((acc: any, t) => {
      const date = new Date(t.date).toLocaleDateString();
      const found = acc.find((g: any) => g.title === date);
      if (found) found.data.push(t);
      else acc.push({ title: date, data: [t] });
      return acc;
    }, []);
    return groups;
  }, [filteredTransactions]);

  const updateBudgetLimit = (limit: number) => {
    const key = `${selectedMonth}-${selectedYear}`;
    const newBudgets = { ...budgets, [key]: limit };
    setBudgets(newBudgets);
    saveData(transactions, newBudgets);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>History</Text>
          <TouchableOpacity 
            style={styles.filterTrigger}
            onPress={() => setIsPickerOpen(true)}
          >
            <Text style={styles.filterText}>{selectedMonth} {selectedYear}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>REMAINING BUDGET</Text>
          <Text style={[styles.balanceText, { color: (currentBudgetLimit - totals.expense) < 0 ? colors.error : colors.text }]}>
            ${(currentBudgetLimit - totals.expense).toFixed(0)}
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, { color: colors.tertiary }]}>+${totals.income.toFixed(0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Spent</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>-${totals.expense.toFixed(0)}</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.statItem} onPress={() => setIsSettingsOpen(true)}>
              <Text style={styles.statLabel}>Limit</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Text style={styles.statValue}>${currentBudgetLimit.toFixed(0)}</Text>
                <Ionicons name="pencil" size={12} color={colors.textVariant} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={t => t.id}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.transactionCard}
            onLongPress={() => {
              Alert.alert('Delete Entry', 'Remove this transaction?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(item.id) }
              ]);
            }}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.type === 'expense' ? colors.error + '15' : colors.tertiary + '15' }]}>
              <Ionicons 
                name={(CATEGORIES[item.type as 'expense' | 'income']).find((c: any) => c.name === item.category)?.icon as any || 'help'} 
                size={22} 
                color={item.type === 'expense' ? colors.error : colors.tertiary} 
              />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txCategory}>{item.category}</Text>
              {item.comment ? <Text style={styles.txComment}>{item.comment}</Text> : null}
            </View>
            <Text style={[styles.txAmount, { color: item.type === 'expense' ? colors.error : colors.tertiary }]}>
              {item.type === 'expense' ? '-' : '+'}${item.amount.toFixed(0)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={isDark ? colors.surfaceContainer : "#E0E0EF"} />
            <Text style={styles.emptyText}>No transactions for this period</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setIsAdding(true)}>
        <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>New Entry</Text>
                <TouchableOpacity onPress={() => setIsAdding(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.typeToggle}>
                 <TouchableOpacity 
                   style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]} 
                   onPress={() => { setType('expense'); setCategory(CATEGORIES.expense[0].name); }}
                 >
                   <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.typeBtn, type === 'income' && styles.typeBtnActive]} 
                   onPress={() => { setType('income'); setCategory(CATEGORIES.income[0].name); }}
                 >
                   <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
                 </TouchableOpacity>
              </View>

              <View style={styles.amountInputRow}>
                <Text style={styles.currency}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.textVariant}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  autoFocus
                />
              </View>

              <View style={styles.categoryList}>
                <Text style={styles.inputLabel}>CATEGORY</Text>
                <FlatList
                   horizontal
                   showsHorizontalScrollIndicator={false}
                   data={CATEGORIES[type]}
                   renderItem={({ item }) => (
                     <TouchableOpacity 
                       style={styles.catItem}
                       onPress={() => setCategory(item.name)}
                     >
                       <View style={[styles.catIconBox, category === item.name && { backgroundColor: type === 'expense' ? colors.error : colors.tertiary }]}>
                         <Ionicons name={item.icon as any} size={22} color={category === item.name ? '#FFF' : colors.text} />
                       </View>
                       <Text style={[styles.catName, { color: category === item.name ? colors.primary : colors.textVariant }]}>{item.name}</Text>
                     </TouchableOpacity>
                   )}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NOTES</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="What was this for?"
                  placeholderTextColor={colors.textVariant}
                  value={comment}
                  onChangeText={setComment}
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={addTransaction}>
                <Text style={styles.submitBtnText}>Add Transaction</Text>
              </TouchableOpacity>
            </View>
           </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Period Picker Modal */}
      <Modal visible={isPickerOpen} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.sheet, { maxHeight: '80%' }]}>
              <Text style={[styles.sheetTitle, { marginBottom: 20 }]}>Select Period</Text>
              <ScrollView>
                <Text style={styles.inputLabel}>YEAR</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
                  {YEARS.map(y => (
                    <TouchableOpacity 
                      key={y} 
                      style={[styles.filterTrigger, selectedYear === y && { backgroundColor: colors.primary }]}
                      onPress={() => setSelectedYear(y)}
                    >
                      <Text style={[styles.filterText, selectedYear === y && { color: '#FFF' }]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>MONTH</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                  {MONTHS.map(m => (
                    <TouchableOpacity 
                      key={m} 
                      style={[styles.monthCard, selectedMonth === m && { backgroundColor: colors.primary }]}
                      onPress={() => setSelectedMonth(m)}
                    >
                      <Text style={[styles.filterText, selectedMonth === m && { color: '#FFF' }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity 
                style={[styles.submitBtn, { marginTop: 24 }]} 
                onPress={() => setIsPickerOpen(false)}
              >
                <Text style={styles.submitBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Budget Settings Modal */}
      <Modal visible={isSettingsOpen} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={[styles.sheet, { borderRadius: 28 }]}>
            <Text style={styles.sheetTitle}>Set Budget Limit</Text>
            <Text style={[styles.txComment, { marginBottom: 20 }]}>For {selectedMonth} {selectedYear}</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                style={[styles.amountInput, { fontSize: 36 }]}
                defaultValue={currentBudgetLimit.toString()}
                keyboardType="numeric"
                onEndEditing={(e) => updateBudgetLimit(parseFloat(e.nativeEvent.text) || 0)}
                autoFocus
              />
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={() => setIsSettingsOpen(false)}>
              <Text style={styles.submitBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
