###
Chosen source: generate output using 'cake build'
Copyright (c) 2011 by Harvest
###
root = this

class Chosen extends AbstractChosen

  setup: ->
    @current_value = @form_field.value
    @is_rtl = @form_field.hasClassName "chzn-rtl"

  finish_setup: ->
    @form_field.addClassName "chzn-done"

  set_default_values: ->
    super()

    # HTML Templates
    @single_temp = new Template('<a href="javascript:void(0)" class="chzn-single chzn-default" tabindex="-1"><span>#{default}</span><div><b></b></div></a><div class="chzn-drop" style="left:-9000px;"><div class="chzn-search"><input type="text" autocomplete="off" /></div><ul class="chzn-results"></ul></div>')
    @multi_temp = new Template('<ul class="chzn-choices"><li class="search-field"><input type="text" value="#{default}" class="default" autocomplete="off" style="width:25px;" /></li></ul><div class="chzn-drop" style="left:-9000px;"><ul class="chzn-results"></ul></div>')
    @choice_temp = new Template('<li class="search-choice" id="#{id}"><span>#{choice}</span><a href="javascript:void(0)" class="search-choice-close" rel="#{position}"></a></li>')
    @choice_noclose_temp = new Template('<li class="search-choice search-choice-disabled" id="#{id}"><span>#{choice}</span></li>')
    @no_results_temp = new Template('<li class="no-results">' + @results_none_found + ' "<span>#{terms}</span>"</li>')

  set_up_html: ->
    @container_id = @form_field.identify().replace(/[^\w]/g, '_') + "_chzn"

    container_classes = ["chzn-container"]
    container_classes.push "chzn-container-" + (if @is_multiple then "multi" else "single")
    container_classes.push @form_field.className if @inherit_select_classes && @form_field.className
    container_classes.push "chzn-rtl" if @is_rtl

    @f_width = if @form_field.getStyle("width") then parseInt @form_field.getStyle("width"), 10 else @form_field.getWidth()

    container_props =
      'id': @container_id
      'class': container_classes.join ' '
      'style': 'width: ' + (@f_width) + 'px' #use parens around @f_width so coffeescript doesn't think + ' px' is a function parameter
      'title': @form_field.title
    
    base_template = if @is_multiple then new Element('div', container_props).update( @multi_temp.evaluate({ "default": @default_text}) ) else new Element('div', container_props).update( @single_temp.evaluate({ "default":@default_text }) )

    @form_field.hide().insert({ after: base_template })
    @container = $(@container_id)
    @dropdown = @container.down('div.chzn-drop')

    dd_top = @container.getHeight()
    dd_width = (@f_width - get_side_border_padding(@dropdown))

    @dropdown.setStyle({"width": dd_width  + "px", "top": dd_top + "px"})

    @search_field = @container.down('input')
    @search_results = @container.down('ul.chzn-results')
    this.search_field_scale()

    @search_no_results = @container.down('li.no-results')

    if @is_multiple
      @search_choices = @container.down('ul.chzn-choices')
      @search_container = @container.down('li.search-field')
    else
      @search_container = @container.down('div.chzn-search')
      @selected_item = @container.down('.chzn-single')
      sf_width = dd_width - get_side_border_padding(@search_container) - get_side_border_padding(@search_field)
      @search_field.setStyle( {"width" : sf_width + "px"} )

    this.results_build()
    this.set_tab_index()
    @form_field.fire("liszt:ready", {chosen: this})

  register_observers: ->
    @container.observe "mousedown", (evt) => this.container_mousedown(evt)
    @container.observe "mouseup", (evt) => this.container_mouseup(evt)
    @container.observe "mouseenter", (evt) => this.mouse_enter(evt)
    @container.observe "mouseleave", (evt) => this.mouse_leave(evt)

    @search_results.observe "mouseup", (evt) => this.search_results_mouseup(evt)
    @search_results.observe "mouseover", (evt) => this.search_results_mouseover(evt)
    @search_results.observe "mouseout", (evt) => this.search_results_mouseout(evt)

    @form_field.observe "liszt:updated", (evt) => this.results_update_field(evt)
    @form_field.observe "liszt:activate", (evt) => this.activate_field(evt)
    @form_field.observe "liszt:open", (evt) => this.container_mousedown(evt)

    @search_field.observe "blur", (evt) => this.input_blur(evt)
    @search_field.observe "keyup", (evt) => this.keyup_checker(evt)
    @search_field.observe "keydown", (evt) => this.keydown_checker(evt)
    @search_field.observe "focus", (evt) => this.input_focus(evt)

    if @is_multiple
      @search_choices.observe "click", (evt) => this.choices_click(evt)
    else
      @container.observe "click", (evt) => evt.preventDefault() # gobble click of anchor

  search_field_disabled: ->
    @is_disabled = @form_field.disabled
    if(@is_disabled)
      @container.addClassName 'chzn-disabled'
      @search_field.disabled = true
      @selected_item.stopObserving "focus", @activate_action if !@is_multiple
      this.close_field()
    else
      @container.removeClassName 'chzn-disabled'
      @search_field.disabled = false
      @selected_item.observe "focus", @activate_action if !@is_multiple

  container_mousedown: (evt) ->
    if !@is_disabled
      target_closelink =  if evt? then evt.target.hasClassName "search-choice-close" else false
      if evt and evt.type is "mousedown" and not @results_showing
        evt.stop()
      if not @pending_destroy_click and not target_closelink
        if not @active_field
          @search_field.clear() if @is_multiple
          document.observe "click", @click_test_action
          this.results_show()
        else if not @is_multiple and evt and (evt.target is @selected_item || evt.target.up("a.chzn-single"))
          this.results_toggle()

        this.activate_field()
      else
        @pending_destroy_click = false

  container_mouseup: (evt) ->
    this.results_reset(evt) if evt.target.nodeName is "ABBR" and not @is_disabled

  blur_test: (evt) ->
    this.close_field() if not @active_field and @container.hasClassName("chzn-container-active")

  close_field: ->
    document.stopObserving "click", @click_test_action

    @active_field = false
    this.results_hide()

    @container.removeClassName "chzn-container-active"
    this.winnow_results_clear()
    this.clear_backstroke()

    this.show_search_field_default()
    this.search_field_scale()

  activate_field: ->
    @container.addClassName "chzn-container-active"
    @active_field = true

    @search_field.value = @search_field.value
    @search_field.focus()

  test_active_click: (evt) ->
    if evt.target.up('#' + @container_id)
      @active_field = true
    else
      this.close_field()

  results_build: ->
    @parsing = true
    @results_data = root.SelectParser.select_to_array @form_field

    if @is_multiple and @choices > 0
      @search_choices.select("li.search-choice").invoke("remove")
      @choices = 0
    else if not @is_multiple
      @selected_item.addClassName("chzn-default").down("span").update(@default_text)
      if @disable_search or @form_field.options.length <= @disable_search_threshold
        @container.addClassName "chzn-container-single-nosearch"
      else
        @container.removeClassName "chzn-container-single-nosearch"

    content = ''
    for data in @results_data
      if data.group
        content += this.result_add_group data
      else if !data.empty
        content += this.result_add_option data
        if data.selected and @is_multiple
          this.choice_build data
        else if data.selected and not @is_multiple
          @selected_item.removeClassName("chzn-default").down("span").update( data.html )
          this.single_deselect_control_build() if @allow_single_deselect

    this.search_field_disabled()
    this.show_search_field_default()
    this.search_field_scale()

    @search_results.update content
    @parsing = false


  result_add_group: (group) ->
    if not group.disabled
      group.dom_id = @container_id + "_g_" + group.array_index
      '<li id="' + group.dom_id + '" class="group-result">' + group.label.escapeHTML() + '</li>'
    else
      ""

  result_do_highlight: (el) ->
      this.result_clear_highlight()

      @result_highlight = el
      @result_highlight.addClassName "highlighted"

      maxHeight = parseInt @search_results.getStyle('maxHeight'), 10
      visible_top = @search_results.scrollTop
      visible_bottom = maxHeight + visible_top

      high_top = @result_highlight.positionedOffset().top
      high_bottom = high_top + @result_highlight.getHeight()

      if high_bottom >= visible_bottom
        @search_results.scrollTop = if (high_bottom - maxHeight) > 0 then (high_bottom - maxHeight) else 0
      else if high_top < visible_top
        @search_results.scrollTop = high_top

  result_clear_highlight: ->
    @result_highlight.removeClassName('highlighted') if @result_highlight
    @result_highlight = null

  results_show: ->
    if not @is_multiple
      @selected_item.addClassName('chzn-single-with-drop')
      if @result_single_selected
        this.result_do_highlight( @result_single_selected )
    else if @max_selected_options <= @choices
      @form_field.fire("liszt:maxselected", {chosen: this})
      return false

    dd_top = if @is_multiple then @container.getHeight() else (@container.getHeight() - 1)
    @form_field.fire("liszt:showing_dropdown", {chosen: this})
    @dropdown.setStyle {"top":  dd_top + "px", "left":0}
    @results_showing = true

    @search_field.focus()
    @search_field.value = @search_field.value

    this.winnow_results()

  results_hide: ->
    @selected_item.removeClassName('chzn-single-with-drop') unless @is_multiple
    this.result_clear_highlight()
    @form_field.fire("liszt:hiding_dropdown", {chosen: this})
    @dropdown.setStyle({"left":"-9000px"})
    @results_showing = false


  set_tab_index: (el) ->
    if @form_field.tabIndex
      ti = @form_field.tabIndex
      @form_field.tabIndex = -1
      @search_field.tabIndex = ti

  show_search_field_default: ->
    if @is_multiple and @choices < 1 and not @active_field
      @search_field.value = @default_text
      @search_field.addClassName "default"
    else
      @search_field.value = ""
      @search_field.removeClassName "default"

  search_results_mouseup: (evt) ->
    target = if evt.target.hasClassName("active-result") then evt.target else evt.target.up(".active-result")
    if target
      @result_highlight = target
      this.result_select(evt)
      @search_field.focus()

  search_results_mouseover: (evt) ->
    target = if evt.target.hasClassName("active-result") then evt.target else evt.target.up(".active-result")
    this.result_do_highlight( target ) if target

  search_results_mouseout: (evt) ->
    this.result_clear_highlight() if evt.target.hasClassName('active-result') or evt.target.up('.active-result')


  choices_click: (evt) ->
    evt.preventDefault()
    if( @active_field and not(evt.target.hasClassName('search-choice') or evt.target.up('.search-choice')) and not @results_showing )
      this.results_show()

  choice_build: (item) ->
    if @is_multiple and @max_selected_options <= @choices
      @form_field.fire("liszt:maxselected", {chosen: this})
      return false
    choice_id = @container_id + "_c_" + item.array_index
    @choices += 1
    @search_container.insert
      before: (if item.disabled then @choice_noclose_temp else @choice_temp).evaluate
        id:       choice_id
        choice:   item.html
        position: item.array_index
    if not item.disabled
      link = $(choice_id).down('a')
      link.observe "click", (evt) => this.choice_destroy_link_click(evt)

  choice_destroy_link_click: (evt) ->
    evt.preventDefault()
    if not @is_disabled
      @pending_destroy_click = true
      this.choice_destroy evt.target

  choice_destroy: (link) ->
    if this.result_deselect link.readAttribute("rel")
      @choices -= 1
      this.show_search_field_default()

      this.results_hide() if @is_multiple and @choices > 0 and @search_field.value.length < 1

      link.up('li').remove()

      this.search_field_scale()

  results_reset: ->
    @form_field.options[0].selected = true
    @selected_item.down("span").update(@default_text)
    @selected_item.addClassName("chzn-default") if not @is_multiple
    this.show_search_field_default()
    this.results_reset_cleanup()
    @form_field.simulate("change") if typeof Event.simulate is 'function'
    this.results_hide() if @active_field

  results_reset_cleanup: ->
    @current_value = @form_field.value
    deselect_trigger = @selected_item.down("abbr")
    deselect_trigger.remove() if(deselect_trigger)

  result_select: (evt) ->
    if @result_highlight
      high = @result_highlight
      this.result_clear_highlight()

      if @is_multiple
        this.result_deactivate high
      else
        @search_results.descendants(".result-selected").invoke "removeClassName", "result-selected"
        @selected_item.removeClassName("chzn-default")
        @result_single_selected = high

      high.addClassName("result-selected")

      position = high.id.substr(high.id.lastIndexOf("_") + 1 )
      item = @results_data[position]
      item.selected = true

      @form_field.options[item.options_index].selected = true

      if @is_multiple
        this.choice_build item
      else
        @selected_item.down("span").update(item.html)
        this.single_deselect_control_build() if @allow_single_deselect

      this.results_hide() unless (evt.metaKey or evt.ctrlKey) and @is_multiple

      @search_field.value = ""

      @form_field.simulate("change") if typeof Event.simulate is 'function' && (@is_multiple || @form_field.value != @current_value)
      @current_value = @form_field.value

      this.search_field_scale()

  result_activate: (el) ->
    el.addClassName("active-result")

  result_deactivate: (el) ->
    el.removeClassName("active-result")

  result_deselect: (pos) ->
    result_data = @results_data[pos]

    if not @form_field.options[result_data.options_index].disabled
      result_data.selected = false

      @form_field.options[result_data.options_index].selected = false
      result = $(@container_id + "_o_" + pos)
      result.removeClassName("result-selected").addClassName("active-result").show()

      this.result_clear_highlight()
      this.winnow_results()

      @form_field.simulate("change") if typeof Event.simulate is 'function'
      this.search_field_scale()
      return true
    else
      return false

  single_deselect_control_build: ->
    @selected_item.down("span").insert { after: "<abbr class=\"search-choice-close\"></abbr>" } if @allow_single_deselect and not @selected_item.down("abbr")

  winnow_results: ->
    this.no_results_clear()

    results = 0

    searchText = if @search_field.value is @default_text then "" else @search_field.value.strip().escapeHTML()
    regexAnchor = if @search_contains then "" else "^"
    regex = new RegExp(regexAnchor + searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i')
    zregex = new RegExp(searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i')

    for option in @results_data
      if not option.disabled and not option.empty
        if option.group
          $(option.dom_id).hide()
        else if not (@is_multiple and option.selected)
          found = false
          result_id = option.dom_id

          if regex.test option.html
            found = true
            results += 1
          else if @enable_split_word_search and (option.html.indexOf(" ") >= 0 or option.html.indexOf("[") == 0)
            #TODO: replace this substitution of /\[\]/ with a list of characters to skip.
            parts = option.html.replace(/\[|\]/g, "").split(" ")
            if parts.length
              for part in parts
                if regex.test part
                  found = true
                  results += 1

          if found
            if searchText.length
              startpos = option.html.search zregex
              text = option.html.substr(0, startpos + searchText.length) + '</em>' + option.html.substr(startpos + searchText.length)
              text = text.substr(0, startpos) + '<em>' + text.substr(startpos)
            else
              text = option.html

            $(result_id).update text if $(result_id).innerHTML != text

            this.result_activate $(result_id)

            $(@results_data[option.group_array_index].dom_id).setStyle({display: 'list-item'}) if option.group_array_index?
          else
            this.result_clear_highlight() if $(result_id) is @result_highlight
            this.result_deactivate $(result_id)

    if results < 1 and searchText.length
      this.no_results(searchText)
    else
      this.winnow_results_set_highlight()

  winnow_results_clear: ->
    @search_field.clear()
    lis = @search_results.select("li")

    for li in lis
      if li.hasClassName("group-result")
        li.show()
      else if not @is_multiple or not li.hasClassName("result-selected")
        this.result_activate li

  winnow_results_set_highlight: ->
    if not @result_highlight

      if not @is_multiple
        do_high = @search_results.down(".result-selected.active-result")

      if not do_high?
        do_high = @search_results.down(".active-result")

      this.result_do_highlight do_high if do_high?

  no_results: (terms) ->
    @search_results.insert @no_results_temp.evaluate( terms: terms )

  no_results_clear: ->
    nr = null
    nr.remove() while nr = @search_results.down(".no-results")


  keydown_arrow: ->
    actives = @search_results.select("li.active-result")
    if actives.length
      if not @result_highlight
        this.result_do_highlight actives.first()
      else if @results_showing
        sibs = @result_highlight.nextSiblings()
        nexts = sibs.intersect(actives)
        this.result_do_highlight nexts.first() if nexts.length
      this.results_show() if not @results_showing

  keyup_arrow: ->
    if not @results_showing and not @is_multiple
      this.results_show()
    else if @result_highlight
      sibs = @result_highlight.previousSiblings()
      actives = @search_results.select("li.active-result")
      prevs = sibs.intersect(actives)

      if prevs.length
        this.result_do_highlight prevs.first()
      else
        this.results_hide() if @choices > 0
        this.result_clear_highlight()

  keydown_backstroke: ->
    if @pending_backstroke
      this.choice_destroy @pending_backstroke.down("a")
      this.clear_backstroke()
    else
      next_available_destroy = @search_container.siblings().last()
      if next_available_destroy and next_available_destroy.hasClassName("search-choice") and not next_available_destroy.hasClassName("search-choice-disabled")
        @pending_backstroke = next_available_destroy
        @pending_backstroke.addClassName("search-choice-focus") if @pending_backstroke
        if @single_backstroke_delete
          @keydown_backstroke()
        else
          @pending_backstroke.addClassName("search-choice-focus")

  clear_backstroke: ->
    @pending_backstroke.removeClassName("search-choice-focus") if @pending_backstroke
    @pending_backstroke = null

  keydown_checker: (evt) ->
    stroke = evt.which ? evt.keyCode
    this.search_field_scale()

    this.clear_backstroke() if stroke != 8 and this.pending_backstroke

    switch stroke
      when 8
        @backstroke_length = this.search_field.value.length
        break
      when 9
        this.result_select(evt) if this.results_showing and not @is_multiple
        @mouse_on_container = false
        break
      when 13
        evt.preventDefault()
        break
      when 38
        evt.preventDefault()
        this.keyup_arrow()
        break
      when 40
        this.keydown_arrow()
        break

  search_field_scale: ->
    if @is_multiple
      h = 0
      w = 0

      style_block = "position:absolute; left: -1000px; top: -1000px; display:none;"
      styles = ['font-size','font-style', 'font-weight', 'font-family','line-height', 'text-transform', 'letter-spacing']

      for style in styles
        style_block += style + ":" + @search_field.getStyle(style) + ";"

      div = new Element('div', { 'style' : style_block }).update(@search_field.value.escapeHTML())
      document.body.appendChild(div)

      w = Element.measure(div, 'width') + 25
      div.remove()

      if( w > @f_width-10 )
        w = @f_width - 10

      @search_field.setStyle({'width': w + 'px'})

      dd_top = @container.getHeight()
      @dropdown.setStyle({"top":  dd_top + "px"})

root.Chosen = Chosen

# Prototype does not support version numbers so we add it ourselves
if Prototype.Browser.IE
  if /MSIE (\d+\.\d+);/.test(navigator.userAgent)
    Prototype.BrowserFeatures['Version'] = new Number(RegExp.$1);


get_side_border_padding = (elmt) ->
  layout = new Element.Layout(elmt)
  side_border_padding = layout.get("border-left") + layout.get("border-right") + layout.get("padding-left") + layout.get("padding-right")

root.get_side_border_padding = get_side_border_padding
