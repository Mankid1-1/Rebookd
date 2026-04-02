import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ALL_AUTOMATIONS, AUTOMATION_CATEGORIES, AUTOMATION_COUNT, catStyles } from "@/data/automations";
import { fadeInUp } from "@/lib/animations";
import { ChevronDown } from "lucide-react";

export function AutomationsExplorer() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const filtered = activeCategory === "all"
    ? ALL_AUTOMATIONS
    : ALL_AUTOMATIONS.filter((a) => a.cat === activeCategory);

  const displayCount = showAll ? filtered.length : Math.min(filtered.length, 12);
  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > 12 && !showAll;

  return (
    <section className="py-16 px-6 border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {AUTOMATION_COUNT} automations, ready to go
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Every one of these is pre-built. Just toggle on what fits your business — no coding, no configuration.
          </p>
        </motion.div>

        {/* Category filter tabs */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-1.5 mb-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          {AUTOMATION_CATEGORIES.map((cat) => {
            const count = cat.key === "all" ? ALL_AUTOMATIONS.length : ALL_AUTOMATIONS.filter((a) => a.cat === cat.key).length;
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveCategory(cat.key); setShowAll(false); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.label}
                <span className={`text-[10px] ${activeCategory === cat.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Automations grid */}
        <TooltipProvider delayDuration={200}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5"
            >
              {displayed.map(({ icon: Icon, label, cat, tip }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card/50 hover:bg-card hover:shadow-sm hover:border-primary/20 transition-all cursor-default">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{label}</p>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 mt-0.5 ${catStyles[cat] ?? ""}`}>{cat}</Badge>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-52 text-center">
                    <p className="text-xs">{tip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </motion.div>
          </AnimatePresence>
        </TooltipProvider>

        {/* Show more button */}
        {hasMore && (
          <div className="text-center mt-4">
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Show all {filtered.length} automations
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
