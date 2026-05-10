import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/SupabaseProvider';
import { Product, UserCategory } from '../types';
import { 
  Search, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  Package, 
  Tag, 
  Calendar, 
  MoreVertical, 
  Filter,
  ArrowUpDown,
  AlertCircle,
  Eye,
  Plus,
  Check,
  X,
  CreditCard,
  User as UserIcon,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/format';

export const Admin: React.FC = () => {
  const { user, settings, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'system'>('products');
  const [sortBy, setSortBy] = useState<'expiryDate' | 'name' | 'price' | 'createdAt'>('expiryDate');

  const [newCatName, setNewCatName] = useState('');
  const [isAddingCat, setIsAddingCat] = useState(false);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Products
      let pQuery = supabase.from('products').select('*');
      if (!isAdmin) pQuery = pQuery.eq('user_id', user.id);
      const { data: pData } = await pQuery;
      if (pData) {
        setProducts(pData.map(p => ({
          id: p.id,
          name: p.name,
          expiryDate: p.expiry_date,
          category: p.category,
          price: Number(p.price) || 0,
          observations: p.observations,
          imageURL: p.image_url,
          userId: p.user_id,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        } as Product)));
      }

      // Categories
      let cQuery = supabase.from('categories').select('*');
      if (!isAdmin) cQuery = cQuery.eq('user_id', user.id);
      const { data: cData } = await cQuery;
      if (cData) {
        setCategories(cData.map(c => ({
          id: c.id,
          name: c.name,
          userId: c.user_id,
          createdAt: c.created_at
        } as UserCategory)));
      }

      if (isAdmin) {
        // Users
        const { data: uData } = await supabase.from('profiles').select('*');
        if (uData) {
          setAllUsers(uData.map(u => ({
            id: u.id,
            displayName: u.display_name,
            email: u.email,
            role: u.role,
            plan: u.plan,
            productCount: u.product_count,
            productLimit: u.product_limit,
            premiumStatus: u.premium_status
          })));
        }

        // Payments
        const { data: payData } = await supabase
          .from('payments')
          .select('*')
          .eq('status', 'pendente');
        if (payData) {
          setPayments(payData.map(p => ({
            id: p.id,
            userId: p.user_id,
            userEmail: p.user_email,
            referencia: p.referencia,
            comprovante_url: p.comprovante_url,
            status: p.status,
            createdAt: p.created_at
          })));
        }
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Subscribe to everything for real-time
    const productsChannel = supabase.channel('admin_products').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData).subscribe();
    const categoriesChannel = supabase.channel('admin_categories').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData).subscribe();
    
    let usersChannel: any;
    let paymentsChannel: any;
    if (isAdmin) {
      usersChannel = supabase.channel('admin_users').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData).subscribe();
      paymentsChannel = supabase.channel('admin_payments').on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData).subscribe();
    }

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(categoriesChannel);
      if (usersChannel) supabase.removeChannel(usersChannel);
      if (paymentsChannel) supabase.removeChannel(paymentsChannel);
    };
  }, [user, isAdmin]);

  const handleApprovePayment = async (paymentId: string, userId: string) => {
    try {
      await supabase.from('profiles').update({
        plan: 'pro',
        product_limit: 500,
        premium_status: 'approved',
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      await supabase.from('payments').update({
        status: 'aprovado',
        processed_at: new Date().toISOString()
      }).eq('id', paymentId);
      
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectPayment = async (paymentId: string, userId: string) => {
    try {
      await supabase.from('profiles').update({
        premium_status: 'rejected',
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      await supabase.from('payments').update({
        status: 'rejeitado',
        processed_at: new Date().toISOString()
      }).eq('id', paymentId);
      
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim() || !user) return;
    const name = newCatName.trim();
    
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert("Esta categoria já existe.");
      return;
    }

    try {
      await supabase.from('categories').insert({
        name,
        user_id: user.id
      });
      setNewCatName('');
      setIsAddingCat(false);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'product' | 'category' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDeleteProduct = async (id: string) => {
    try {
      await supabase.from('products').delete().eq('id', id);
      setDeleteId(null);
      setDeleteType(null);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const productsInCat = products.filter(p => p.category === name);
    if (productsInCat.length > 0) {
      setErrorMessage(`Não é possível excluir esta categoria pois existem ${productsInCat.length} produtos vinculados a ela.`);
      setTimeout(() => setErrorMessage(null), 5000);
      setDeleteId(null);
      setDeleteType(null);
      return;
    }
    try {
      await supabase.from('categories').delete().eq('id', id);
      setDeleteId(null);
      setDeleteType(null);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price') return (b.price || 0) - (a.price || 0);
      if (sortBy === 'expiryDate') return parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const getStatus = (expiryDate: string) => {
    const date = parseISO(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = differenceInDays(date, today);
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();

    if (isPast(date) && !isToday) return { label: 'Vencido', color: 'text-error bg-error/10' };
    if (daysLeft <= (settings.advanceDays || 7)) return { label: 'Crítico', color: 'text-secondary bg-secondary/10' };
    return { label: 'Válido', color: 'text-primary bg-primary/10' };
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-10 text-center space-y-4">
        <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center text-error mb-2">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-black text-on-surface">Acesso Negado</h2>
        <p className="text-sm text-outline leading-relaxed max-w-xs">
          Esta área é restrita a administradores. Seu acesso foi bloqueado e registrado.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-on-surface text-surface rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
        >
          Voltar para Home
        </button>
      </div>
    );
  }

  if (loading) return null;

  return (
    <div className="px-5 md:px-6 py-4 space-y-6 pb-24">
      {/* Search and Tabs */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex bg-surface-container-high p-1 rounded-2xl w-full mx-auto max-w-md">
          <button 
            onClick={() => setActiveTab('products')}
            className={cn(
              "flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'products' ? "bg-white shadow-sm text-primary" : "text-outline"
            )}
          >
            Estoque
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={cn(
              "flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'categories' ? "bg-white shadow-sm text-primary" : "text-outline"
            )}
          >
            Categorias
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={cn(
              "flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5",
              activeTab === 'system' ? "bg-white shadow-sm text-primary" : "text-outline"
            )}
          >
            Sistema
            {payments.length > 0 && (
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
            )}
          </button>
        </div>
        
        {activeTab === 'products' && (
          <div className="flex justify-center">
            <button 
              onClick={() => navigate('/add')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Produto
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(deleteId || errorMessage) && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-x-0 bottom-24 z-[60] px-5 pointer-events-none"
          >
            <div className="max-w-md mx-auto bg-on-surface text-surface p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-error" />
                <p className="text-xs font-bold leading-tight">
                  {errorMessage || (deleteType === 'product' ? 'Tem certeza que deseja excluir este produto?' : 'Deseja excluir esta categoria?')}
                </p>
              </div>
              <div className="flex gap-2">
                {errorMessage ? (
                   <button 
                    onClick={() => setErrorMessage(null)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setDeleteId(null);
                        setDeleteType(null);
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        if (deleteType === 'product') handleDeleteProduct(deleteId!);
                        else handleDeleteCategory(deleteId!, products.find(p => p.id === deleteId)?.name || categories.find(c => c.id === deleteId)?.name || '');
                      }}
                      className="px-3 py-1.5 bg-error text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'products' ? (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
              <input 
                type="text" 
                placeholder={isAdmin ? "Pesquisar em todo o estoque..." : "Pesquisar estoque..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-outline-variant/30 bg-white text-sm focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-outline/40"
              />
            </div>
            <div className="bg-white border border-outline-variant/30 rounded-2xl p-1 flex items-center shrink-0">
               <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-[10px] font-black text-outline uppercase tracking-widest focus:ring-0 outline-none cursor-pointer pr-8"
              >
                <option value="expiryDate">Validade</option>
                <option value="name">Nome</option>
                <option value="price">Preço</option>
                <option value="createdAt">Cadastro</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="space-y-2">
            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto text-outline/30">
                  <Package className="w-8 h-8" />
                </div>
                <p className="text-outline text-sm">Nenhum produto encontrado</p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const status = getStatus(product.expiryDate);
                const owner = allUsers.find(u => u.id === product.userId);
                return (
                  <motion.div 
                    layout
                    key={product.id}
                    className="bg-white p-4 rounded-2xl border border-outline-variant/20 shadow-sm flex items-center gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 overflow-hidden border border-outline-variant/10">
                      {product.imageURL ? (
                        <img src={product.imageURL} className="w-full h-full object-cover" alt={product.name} />
                      ) : (
                        <Package className="w-6 h-6 text-outline/30" />
                      )}
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-sm text-on-surface truncate">{product.name}</h3>
                        <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter", status.color)}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-outline text-[10px] font-medium tracking-tight">
                        <span className="flex items-center gap-1 uppercase">
                          <Tag className="w-2.5 h-2.5" />
                          {product.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(parseISO(product.expiryDate), 'dd/MM/yy')}
                        </span>
                        {isAdmin && owner && (
                          <span className="flex items-center gap-1 truncate max-w-[80px]">
                            <Plus className="w-2.5 h-2.5" />
                            {owner.displayName || owner.email?.split('@')[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button 
                        disabled={deleteId === product.id}
                        onClick={() => navigate(`/product/${product.id}`)}
                        className="p-2 hover:bg-primary/10 text-outline hover:text-primary rounded-xl transition-all active:scale-90 disabled:opacity-30"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        disabled={deleteId === product.id}
                        onClick={() => navigate(`/product/edit/${product.id}`)}
                        className="p-2 hover:bg-primary/10 text-outline hover:text-primary rounded-xl transition-all active:scale-90 disabled:opacity-30"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setDeleteId(product.id);
                          setDeleteType('product');
                        }}
                        className={cn(
                          "p-2 rounded-xl transition-all active:scale-90",
                          deleteId === product.id ? "bg-error text-white" : "hover:bg-error/10 text-outline hover:text-error"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      ) : activeTab === 'categories' ? (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/20 shadow-sm space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-on-surface">Categorias</h2>
              {!isAddingCat && (
                <button 
                  onClick={() => setIsAddingCat(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Categoria
                </button>
              )}
            </div>

            <AnimatePresence>
              {isAddingCat && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex gap-2 mb-4"
                >
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Nome da categoria..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory();
                      if (e.key === 'Escape') setIsAddingCat(false);
                    }}
                    className="flex-1 px-4 py-2 rounded-xl border border-primary/30 bg-surface-container-low text-xs focus:ring-2 focus:ring-primary outline-none"
                  />
                  <button 
                    onClick={handleCreateCategory}
                    className="p-2 bg-primary text-white rounded-xl active:scale-90 transition-all shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setIsAddingCat(false);
                      setNewCatName('');
                    }}
                    className="p-2 bg-surface-container-high text-on-surface-variant rounded-xl active:scale-90 transition-all border border-outline-variant/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-2">
              {categories.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/50">
                  <p className="text-xs text-outline italic">Nenhuma categoria encontrada</p>
                </div>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 pl-4 bg-surface-container-low rounded-2xl group hover:bg-white transition-all border border-transparent hover:border-outline-variant/30">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-on-surface">{cat.name}</span>
                        {isAdmin && (
                          <span className="text-[8px] text-outline uppercase tracking-wider">
                            UID: {cat.userId.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold text-outline uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-outline-variant/20">
                        {products.filter(p => p.category === cat.name).length} itens
                      </span>
                    </div>
                    {(isAdmin || cat.userId === user?.uid) && (
                      <button 
                        onClick={() => {
                          setDeleteId(cat.id);
                          setDeleteType('category');
                        }}
                        className={cn(
                          "p-2 rounded-xl transition-all active:scale-90",
                          deleteId === cat.id ? "bg-error text-white" : "text-outline hover:text-error hover:bg-error/10"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary p-5 rounded-3xl text-white shadow-lg shadow-primary/20">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Usuários</span>
              <div className="text-3xl font-black mt-1">{allUsers.length}</div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-outline-variant/20 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-outline">Premium Ativos</span>
              <div className="text-3xl font-black mt-1 text-on-surface">
                {allUsers.filter(u => u.plan === 'premium').length}
              </div>
            </div>
          </div>

          {/* Premium Requests */}
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/20 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-secondary" />
                <h2 className="text-lg font-bold text-on-surface">Pagamentos Pendentes</h2>
              </div>
              <span className="px-2.5 py-1 bg-secondary/10 text-secondary text-[10px] font-black rounded-full">
                {payments.length} TOTAL
              </span>
            </div>

            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="py-6 text-center text-outline text-xs italic bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/50">
                  Nenhuma solicitação de upgrade pendente
                </div>
              ) : (
                payments.map((p) => {
                  const userReq = allUsers.find(u => u.id === p.userId);
                  return (
                    <div key={p.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-sm font-bold text-on-surface block truncate">
                            {userReq?.displayName || 'Usuário'}
                          </span>
                          <span className="text-[10px] text-outline truncate block">{p.userEmail}</span>
                        </div>
                        <div className="text-[8px] font-black bg-secondary/10 text-secondary px-2 py-1 rounded-full uppercase tracking-widest shrink-0">
                          PENDENTE
                        </div>
                      </div>

                      {p.comprovante_url && (
                        <a 
                          href={p.comprovante_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-outline-variant/20 text-[10px] font-bold text-primary hover:bg-primary/5 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver Comprovante
                        </a>
                      )}

                      <div className="text-[8px] text-outline uppercase tracking-wider font-bold">
                        REF: {p.referencia}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApprovePayment(p.id, p.userId)}
                          className="flex-1 py-2 px-4 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Aprovar
                        </button>
                        <button 
                          onClick={() => handleRejectPayment(p.id, p.userId)}
                          className="flex-1 py-2 px-4 bg-surface-container-high text-on-surface rounded-xl text-[10px] font-black uppercase tracking-widest border border-outline-variant/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <X className="w-3.5 h-3.5" />
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* All Users List */}
          <div className="bg-white p-6 rounded-3xl border border-outline-variant/20 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-on-surface">Base de Usuários</h2>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {allUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-bold text-on-surface truncate">{u.displayName || u.email?.split('@')[0]}</span>
                    <span className={cn(
                      "text-[8px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full w-fit mt-1",
                      u.role === 'admin' ? "bg-on-surface text-surface" : u.plan === 'pro' ? "bg-secondary/20 text-secondary" : "bg-outline/10 text-outline"
                    )}>
                      {u.role === 'admin' ? 'Administrador' : u.plan === 'pro' ? 'PRO' : 'BASIC'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black bg-white border border-outline-variant/20 px-2.5 py-1 rounded-full text-outline shadow-inner">
                      {u.productCount || 0}/{u.productLimit || 100} ITENS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'system' && (
        <div className="bg-surface-container-high p-5 rounded-3xl border border-outline-variant/10 flex items-start gap-4">
          <div className="p-2 bg-white rounded-xl shadow-sm text-primary">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-on-surface">Informação</h4>
            <p className="text-xs text-outline leading-relaxed">
              {isAdmin 
                ? "Como administrador, você visualiza e gerencia todos os produtos e categorias de todos os usuários do sistema."
                : "As categorias devem ser criadas aqui no Painel administrativo para serem utilizadas no cadastro de produtos. A exclusão de uma categoria só é permitida quando não houver produtos vinculados a ela."
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
