<?php
add_action( 'acf/init', function () {
	acf_add_local_field_group( array(
		'key'      => 'group_course',
		'title'    => 'Course',
		'fields'   => array(
			array( 'key' => 'field_start', 'name' => 'start', 'label' => 'Дата старту', 'type' => 'date_picker', 'display_format' => 'd F, Y', 'return_format' => 'd F, Y' ),
			array( 'key' => 'field_webinar', 'name' => 'webinar', 'label' => 'Вебінар', 'type' => 'date_time_picker', 'display_format' => 'd/m/Y g:i a', 'return_format' => 'd/m/Y g:i a' ),
			array( 'key' => 'field_time', 'name' => 'time', 'label' => 'Час', 'type' => 'time_picker', 'return_format' => 'g:i a' ),
			array( 'key' => 'field_early', 'name' => 'early', 'label' => 'Ранні пташки', 'type' => 'text' ),
			array( 'key' => 'field_show', 'name' => 'show', 'label' => 'Показати', 'type' => 'true_false' ),
			array( 'key' => 'field_level', 'name' => 'level', 'label' => 'Рівень', 'type' => 'select', 'choices' => array( 'base' => 'Базовий', 'pro' => 'Інтенсив' ) ),
			array( 'key' => 'field_about', 'name' => 'about', 'label' => 'Про курс', 'type' => 'group', 'sub_fields' => array(
				array( 'key' => 'field_about_title', 'name' => 'title', 'label' => 'Title', 'type' => 'text' ),
			) ),
		),
		'location' => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ) ) ),
	) );
} );
